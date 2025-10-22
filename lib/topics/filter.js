'use strict';

const privileges = require('../privileges');
const topics = require('../topics');

async function filterVisibleTopics(topics, viewerUid) {
	if (!Array.isArray(topics) || !topics.length) {
		return [];
	}

	const visibility = await Promise.all(topics.map(async (t) => {
		const isPrivate = parseInt(t.private, 10) === 1;

		// Always show public topics
		if (!isPrivate) {
			return true;
		}

		// Show private topics only if:
		// 1. Viewer is the topic owner
		// 2. Viewer is an admin or moderator
		const isOwner = String(t.uid) === String(viewerUid);
		const isPrivileged = viewerUid ? await privileges.topics.isAdminOrMod(t.tid, viewerUid) : false;

		return isOwner || isPrivileged;
	}));

	return topics.filter((t, idx) => visibility[idx]);
}

async function filterVisiblePosts(postsList, viewerUid) {
	if (!Array.isArray(postsList) || !postsList.length) {
		return [];
	}

	const visibility = await Promise.all(postsList.map(async (p) => {
		let topic = p.topic || {};

		if (!topic.tid) {
			topic.tid = p.tid || await topics.getPostField(p.pid, 'tid');
		}
		if (topic.tid && (topic.private === undefined || topic.uid === undefined)) {
			const fields = await topics.getTopicFields(topic.tid, ['private', 'uid']);
			topic = { ...topic, ...fields };
		}

		const isPrivate = parseInt(topic.private, 10) === 1;
		if (!isPrivate) {
			return true;
		}

		const isOwner = String(topic.uid) === String(viewerUid);
		const isPrivileged = viewerUid ? await privileges.topics.isAdminOrMod(topic.tid, viewerUid) : false;

		return isOwner || isPrivileged;
	}));

	return postsList.filter((p, idx) => visibility[idx]);
}

module.exports = { filterVisibleTopics, filterVisiblePosts };
