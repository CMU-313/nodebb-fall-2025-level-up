'use strict';

const _ = require('lodash');
const validator = require('validator');
const nconf = require('nconf');

const db = require('../database');
const posts = require('../posts');
const utils = require('../utils');
const plugins = require('../plugins');
const meta = require('../meta');
const user = require('../user');
const categories = require('../categories');
const activitypub = require('../activitypub');
const privileges = require('../privileges');
const social = require('../social');

const Topics = module.exports;

require('./data')(Topics);
require('./create')(Topics);
require('./delete')(Topics);
require('./sorted')(Topics);
require('./unread')(Topics);
require('./recent')(Topics);
require('./user')(Topics);
require('./fork')(Topics);
require('./posts')(Topics);
require('./follow')(Topics);
require('./tags')(Topics);
require('./teaser')(Topics);
Topics.scheduled = require('./scheduled');
require('./suggested')(Topics);
require('./tools')(Topics);
Topics.thumbs = require('./thumbs');
require('./bookmarks')(Topics);
require('./merge')(Topics);
Topics.events = require('./events');

Topics.exists = async function (tids) {
	return await db.exists(
		Array.isArray(tids) ? tids.map(tid => `topic:${tid}`) : `topic:${tids}`
	);
};

Topics.getTopicsFromSet = async function (set, uid, start, stop) {
	const tids = await db.getSortedSetRevRange(set, start, stop);
	const topics = await Topics.getTopics(tids, uid);
	Topics.calculateTopicIndices(topics, start);
	return { topics: topics, nextStart: stop + 1 };
};

Topics.getTopics = async function (tids, options) {
	let uid = options;
	if (typeof options === 'object') {
		uid = options.uid;
	}

	tids = await privileges.topics.filterTids('topics:read', tids, uid);
	return await Topics.getTopicsByTids(tids, options);
};

Topics.getTopicsByTids = async function (tids, options) {
	if (!Array.isArray(tids) || !tids.length) {
		return [];
	}
	let uid = options;
	if (typeof options === 'object') {
		uid = options.uid;
	}

	async function loadTopics() {
		const topics = await Topics.getTopicsData(tids);
		const uids = _.uniq(topics
			.map(t => t && t.uid && t.uid.toString())
			.filter(v => utils.isNumber(v) || activitypub.helpers.isUri(v)));
		const cids = _.uniq(topics
			.map(t => t && t.cid && t.cid.toString()));
		const guestTopics = topics.filter(t => t && t.uid === 0);

		async function loadGuestHandles() {
			const mainPids = guestTopics.map(t => t.mainPid);
			const postData = await posts.getPostsFields(mainPids, ['handle']);
			return postData.map(p => p.handle);
		}

		async function loadShowfullnameSettings() {
			if (meta.config.hideFullname) {
				return uids.map(() => ({ showfullname: false }));
			}
			const data = await db.getObjectsFields(uids.map(uid => `user:${uid}:settings`), ['showfullname']);
			data.forEach((settings) => {
				settings.showfullname = parseInt(settings.showfullname, 10) === 1;
			});
			return data;
		}

		const [teasers, users, userSettings, categoriesData, guestHandles, thumbs] = await Promise.all([
			Topics.getTeasers(topics, options),
			user.getUsersFields(uids, ['uid', 'username', 'fullname', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned', 'status']),
			loadShowfullnameSettings(),
			categories.getCategoriesFields(cids, ['cid', 'name', 'slug', 'icon', 'backgroundImage', 'imageClass', 'bgColor', 'color', 'disabled']),
			loadGuestHandles(),
			Topics.thumbs.load(topics),
		]);

		// Check admin status for instructor taglines
		const adminStatuses = await Promise.all(uids.map(async (uid) => {
			return user.isAdministrator ? await user.isAdministrator(uid) : false;
		}));

		users.forEach((userObj, idx) => {
			// Hide fullname if needed
			if (!userSettings[idx].showfullname) {
				userObj.fullname = undefined;
			}

			// Add instructor tagline if user is an administrator
			if (adminStatuses[idx]) {
				userObj.custom_profile_info = userObj.custom_profile_info || [];
				userObj.custom_profile_info.unshift({ content: '<span class="badge bg-primary ms-1 instructor-tag">Instructor</span>' });
			}
		});


		return {
			topics,
			teasers,
			usersMap: _.zipObject(uids, users),
			categoriesMap: _.zipObject(cids, categoriesData),
			tidToGuestHandle: _.zipObject(guestTopics.map(t => t.tid), guestHandles),
			thumbs,
		};
	}

	const [result, hasRead, followData, bookmarks, callerSettings, isViewerAdmin] = await Promise.all([
		loadTopics(),
		Topics.hasReadTopics(tids, uid),
		Topics.getFollowData(tids, uid),
		Topics.getUserBookmarks(tids, uid),
		user.getSettings(uid),
		user.isAdministrator(uid),
	]);

	const sortNewToOld = callerSettings.topicPostSort === 'newest_to_oldest';
	result.topics.forEach((topic, i) => {
		if (topic) {
			topic.thumbs = result.thumbs[i];
			topic.category = result.categoriesMap[topic.cid];
			topic.user = topic.uid ? result.usersMap[topic.uid] : { ...result.usersMap[topic.uid] };
			if (result.tidToGuestHandle[topic.tid]) {
				topic.user.username = validator.escape(result.tidToGuestHandle[topic.tid]);
				topic.user.displayname = topic.user.username;
			}

			// Handle anonymous topics - check if topic author should be displayed as anonymous
			const isAnonymous = parseInt(topic.anonymous, 10) === 1;
			const isTopicAuthor = parseInt(uid, 10) === parseInt(topic.uid, 10);
			if (isAnonymous && !isViewerAdmin && !isTopicAuthor) {
				// Replace topic author with anonymous user for non-admin/non-author viewers
				const anonymousName = utils.generateAnonymousName(topic.uid, topic.tid);
				topic.user = {
					uid: 0,
					username: anonymousName,
					userslug: '',
					picture: nconf.get('relative_path') + '/assets/images/anonymous-avatar.png',
					status: 'offline',
					displayname: anonymousName,
					fullname: undefined,
					reputation: 0,
					postcount: 0,
					signature: '',
					banned: 0,
				};
			}
			topic.teaser = result.teasers[i] || null;
			topic.isOwner = topic.uid === parseInt(uid, 10);
			topic.ignored = followData[i].ignoring;
			topic.followed = followData[i].following;
			topic.unread = parseInt(uid, 10) <= 0 || (!hasRead[i] && !topic.ignored);
			topic.bookmark = bookmarks[i] && (sortNewToOld ?
				Math.max(1, topic.postcount + 2 - bookmarks[i]) :
				Math.min(topic.postcount, bookmarks[i] + 1));
			topic.unreplied = !topic.teaser;

			topic.icons = [];
		}
	});

	const filteredTopics = result.topics.filter(topic => topic && topic.category && !topic.category.disabled);

	const hookResult = await plugins.hooks.fire('filter:topics.get', { topics: filteredTopics, uid: uid });

	if (Array.isArray(hookResult.topics)) {
		await Promise.all(hookResult.topics.map(async (topic) => {
			if (!topic) return;
			topic.private = parseInt(topic.private, 10) || 0;
			topic.isAdminOrMod = await privileges.topics.isAdminOrMod(topic.tid, uid);
		}));
	}
	
	return hookResult.topics;
};

Topics.getTopicWithPosts = async function (topicData, set, uid, start, stop, reverse) {
	const [
		posts,
		category,
		tagWhitelist,
		threadTools,
		followData,
		bookmark,
		postSharing,
		deleter,
		merger,
		forker,
		related,
		thumbs,
		events,
	] = await Promise.all([
		Topics.getTopicPosts(topicData, set, start, stop, uid, reverse),
		categories.getCategoryData(topicData.cid),
		categories.getTagWhitelist([topicData.cid]),
		plugins.hooks.fire('filter:topic.thread_tools', { topic: topicData, uid: uid, tools: [] }),
		Topics.getFollowData([topicData.tid], uid),
		Topics.getUserBookmark(topicData.tid, uid),
		social.getActivePostSharing(),
		getDeleter(topicData),
		getMerger(topicData),
		getForker(topicData),
		Topics.getRelatedTopics(topicData, uid),
		Topics.thumbs.load([topicData]),
		Topics.events.get(topicData.tid, uid, reverse),
	]);

	topicData.thumbs = thumbs[0];
	topicData.posts = posts;
	topicData.posts.forEach((p) => {
		p.events = events.filter(
			event => event.timestamp >= p.eventStart && event.timestamp < p.eventEnd
		);
		p.eventStart = undefined;
		p.eventEnd = undefined;
		p.events = mergeConsecutiveShareEvents(p.events);
	});

	topicData.category = category;
	topicData.tagWhitelist = tagWhitelist[0];
	topicData.minTags = category.minTags;
	topicData.maxTags = category.maxTags;
	topicData.thread_tools = threadTools.tools;
	topicData.isFollowing = followData[0].following;
	topicData.isNotFollowing = !followData[0].following && !followData[0].ignoring;
	topicData.isIgnoring = followData[0].ignoring;
	topicData.bookmark = bookmark;
	topicData.postSharing = postSharing;
	topicData.deleter = deleter;
	if (deleter) {
		topicData.deletedTimestampISO = utils.toISOString(topicData.deletedTimestamp);
	}
	topicData.merger = merger;
	if (merger) {
		topicData.mergedTimestampISO = utils.toISOString(topicData.mergedTimestamp);
	}
	topicData.forker = forker;
	if (forker) {
		topicData.forkTimestampISO = utils.toISOString(topicData.forkTimestamp);
	}
	topicData.related = related || [];
	topicData.unreplied = topicData.postcount === 1;
	topicData.icons = [];

	const result = await plugins.hooks.fire('filter:topic.get', { topic: topicData, uid: uid });
	return result.topic;
};

function mergeConsecutiveShareEvents(arr) {
	return arr.reduce((acc, curr) => {
		const last = acc[acc.length - 1];
		if (last && last.type === curr.type && last.type === 'share') {
			if (!last.items) {
				last.items = [{ ...last }];
				['user', 'text', 'timestamp', 'timestampISO'].forEach(field => delete last[field]);
			}
			last.items.push(curr);
		} else {
			acc.push(curr);
		}
		return acc;
	}, []);
}


async function getDeleter(topicData) {
	if (!parseInt(topicData.deleterUid, 10)) {
		return null;
	}
	return await user.getUserFields(topicData.deleterUid, ['username', 'userslug', 'picture']);
}

async function getMerger(topicData) {
	if (!parseInt(topicData.mergerUid, 10)) {
		return null;
	}
	const [
		merger,
		mergedIntoTitle,
	] = await Promise.all([
		user.getUserFields(topicData.mergerUid, ['username', 'userslug', 'picture']),
		Topics.getTopicField(topicData.mergeIntoTid, 'title'),
	]);
	merger.mergedIntoTitle = mergedIntoTitle;
	return merger;
}

async function getForker(topicData) {
	if (!parseInt(topicData.forkerUid, 10)) {
		return null;
	}
	const [
		forker,
		forkedFromTitle,
	] = await Promise.all([
		user.getUserFields(topicData.forkerUid, ['username', 'userslug', 'picture']),
		Topics.getTopicField(topicData.forkedFromTid, 'title'),
	]);
	forker.forkedFromTitle = forkedFromTitle;
	return forker;
}

Topics.getMainPost = async function (tid, uid) {
	const mainPosts = await Topics.getMainPosts([tid], uid);
	return Array.isArray(mainPosts) && mainPosts.length ? mainPosts[0] : null;
};

Topics.getMainPids = async function (tids) {
	if (!Array.isArray(tids) || !tids.length) {
		return [];
	}
	const topicData = await Topics.getTopicsFields(tids, ['mainPid']);
	return topicData.map(topic => topic && topic.mainPid);
};

Topics.getMainPosts = async function (tids, uid) {
	const mainPids = await Topics.getMainPids(tids);
	return await getMainPosts(mainPids, uid);
};

async function getMainPosts(mainPids, uid) {
	let postData = await posts.getPostsByPids(mainPids, uid);
	postData = await user.blocks.filter(uid, postData);
	postData.forEach((post) => {
		if (post) {
			post.index = 0;
		}
	});
	return await Topics.addPostData(postData, uid);
}

Topics.isLocked = async function (tid) {
	const locked = await Topics.getTopicField(tid, 'locked');
	return locked === 1;
};

Topics.search = async function (tid, term) {
	if (!tid || !term) {
		throw new Error('[[error:invalid-data]]');
	}
	const result = await plugins.hooks.fire('filter:topic.search', {
		tid: tid,
		term: term,
		ids: [],
	});
	return Array.isArray(result) ? result : result.ids;
};

/**
 * Return counts for only the topics/posts visible to a given user.
 * This excludes private topics for non-staff.
 */
Topics.getVisibleCounts = async function (cid, uid) {
	// Get all topic ids for this category
	const tids = await db.getSortedSetRange(`cid:${cid}:tids`, 0, -1);
	if (!tids.length) {
		return { topicCount: 0, postCount: 0 };
	}

	const allTopics = await Topics.getTopicsByTids(tids, uid);

	// Filter out private topics for non-staff
	const isAdmin = await privileges.users.isAdministrator(uid);
	const isMod = await privileges.users.isModerator(uid);
	const visibleTopics = (isAdmin || isMod) ?
		allTopics :
		allTopics.filter(t => t.private !== '1');

	// Count visible topics and their posts
	const topicCount = visibleTopics.length;
	const postCount = visibleTopics.reduce((sum, t) => sum + (t.postcount || 0), 0);

	return { topicCount, postCount };
};

require('../promisify')(Topics);
