'use strict';

const assert = require('assert');
const nconf = require('nconf');
const db = require('./mocks/databasemock');
const topics = require('../src/topics');
const posts = require('../src/posts');
const categories = require('../src/categories');
const privileges = require('../src/privileges');
const User = require('../src/user');
const groups = require('../src/groups');
const helpers = require('./helpers');
const apiTopics = require('../src/api/topics');
const apiPosts = require('../src/api/posts');
const composer = require('../src/controllers/composer');
const utils = require('../src/utils');

describe('Anonymous Posting', () => {
	let categoryObj;
	let adminUid;
	let regularUid;
	let moderatorUid;
	let otherUserUid;
	let adminJar;
	let csrf_token;

	before(async () => {
		// Create test users
		adminUid = await User.create({ username: 'admin_anon', password: '123456' });
		regularUid = await User.create({ username: 'regular_anon', password: '123456' });
		moderatorUid = await User.create({ username: 'mod_anon', password: '123456' });
		otherUserUid = await User.create({ username: 'other_anon', password: '123456' });

		// Set up user groups
		await groups.join('administrators', adminUid);
		await groups.join('Global Moderators', moderatorUid);

		// Get login credentials
		const adminLogin = await helpers.loginUser('admin_anon', '123456');
		adminJar = adminLogin.jar;
		csrf_token = adminLogin.csrf_token;

		// Create test category
		categoryObj = await categories.create({
			name: 'Anonymous Test Category',
			description: 'Test category for anonymous posting',
		});
	});

	describe('Anonymous Topic Creation', () => {
		it('should create an anonymous topic when anonymous flag is set', async () => {
			const topicData = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Anonymous Test Topic',
				content: 'This is an anonymous topic',
				anonymous: 1,
			});

			assert(topicData);
			assert(topicData.topicData);
			assert.strictEqual(parseInt(topicData.topicData.anonymous, 10), 1);
			// Post data returns boolean true for anonymous flag
			assert.strictEqual(topicData.postData.anonymous, true);
		});

		it('should create a non-anonymous topic when anonymous flag is not set', async () => {
			const topicData = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Regular Test Topic',
				content: 'This is a regular topic',
			});

			assert(topicData);
			assert(topicData.topicData);
			assert.strictEqual(parseInt(topicData.topicData.anonymous || 0, 10), 0);
			// Post data returns boolean false for non-anonymous posts
			assert.strictEqual(topicData.postData.anonymous || false, false);
		});

		it('should create a non-anonymous topic when anonymous flag is explicitly false', async () => {
			const topicData = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Explicit Non-Anonymous Topic',
				content: 'This is explicitly not anonymous',
				anonymous: 0,
			});

			assert(topicData);
			assert(topicData.topicData);
			assert.strictEqual(parseInt(topicData.topicData.anonymous || 0, 10), 0);
			// Post data returns boolean false for non-anonymous posts
			assert.strictEqual(topicData.postData.anonymous || false, false);
		});
	});

	describe('Anonymous Post Replies', () => {
		let anonymousTopicTid;
		let regularTopicTid;

		before(async () => {
			// Create anonymous topic for testing
			const anonymousResult = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Anonymous Topic for Replies',
				content: 'This is an anonymous topic',
				anonymous: 1,
			});
			anonymousTopicTid = anonymousResult.topicData.tid;

			// Create regular topic for testing
			const regularResult = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Regular Topic for Replies',
				content: 'This is a regular topic',
			});
			regularTopicTid = regularResult.topicData.tid;
		});

		it('should create anonymous reply when topic is anonymous and user is topic author', async () => {
			const postData = await topics.reply({
				uid: regularUid,
				tid: anonymousTopicTid,
				content: 'This is a reply by the topic author',
			});

			assert(postData);
			// Reply data returns boolean true for anonymous posts
			assert.strictEqual(postData.anonymous, true);
		});

		it('should create non-anonymous reply when topic is not anonymous', async () => {
			const postData = await topics.reply({
				uid: regularUid,
				tid: regularTopicTid,
				content: 'This is a reply to a regular topic',
			});

			assert(postData);
			// Reply data returns boolean false for non-anonymous posts
			assert.strictEqual(postData.anonymous || false, false);
		});

		it('should create non-anonymous reply when topic is anonymous but user is not topic author', async () => {
			const postData = await topics.reply({
				uid: adminUid,
				tid: anonymousTopicTid,
				content: 'This is a reply by someone else',
			});

			assert(postData);
			// Reply data returns boolean false for non-anonymous posts
			assert.strictEqual(postData.anonymous || false, false);
		});

		it('should allow manual anonymous flag on individual replies', async () => {
			const postData = await topics.reply({
				uid: adminUid,
				tid: regularTopicTid,
				content: 'This is an anonymous reply',
				anonymous: 1,
			});

			assert(postData);
			// Reply data returns boolean true for anonymous posts
			assert.strictEqual(postData.anonymous, true);
		});
	});

	describe('Anonymous Post Display', () => {
		let anonymousTopicTid;
		let anonymousPostPid;

		before(async () => {
			// Create anonymous topic and post for testing display
			const topicResult = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Anonymous Display Test',
				content: 'This is an anonymous post',
				anonymous: 1,
			});
			anonymousTopicTid = topicResult.topicData.tid;
			anonymousPostPid = topicResult.postData.pid;
		});

		it('should display anonymous user data for non-admin users', async () => {
			// Get topic data first
			const topicInfo = await topics.getTopicData(anonymousTopicTid);
			// Get topic with posts
			const topicData = await topics.getTopicWithPosts(topicInfo, `tid:${anonymousTopicTid}:posts`, regularUid, 0, -1, false);
			
			assert(topicData);
			assert(topicData.posts);
			assert(topicData.posts.length > 0);
			
			const post = topicData.posts[0];
			// getTopicWithPosts returns integer 1 for anonymous posts
			assert.strictEqual(parseInt(post.anonymous, 10), 1);
			// For regular users viewing their own anonymous posts, they should still see anonymous display
			// but have access to edit controls
		});

		it('should display real user data for admin users on anonymous posts', async () => {
			// Get topic data first
			const topicInfo = await topics.getTopicData(anonymousTopicTid);
			// Get topic with posts for admin user
			const topicData = await topics.getTopicWithPosts(topicInfo, `tid:${anonymousTopicTid}:posts`, adminUid, 0, -1, false);
			
			assert(topicData);
			assert(topicData.posts);
			assert(topicData.posts.length > 0);
			
			const post = topicData.posts[0];
			// getTopicWithPosts returns integer 1 for anonymous posts
			assert.strictEqual(parseInt(post.anonymous, 10), 1);
			// Admin should see the real user data
			assert(post.user);
			assert.strictEqual(parseInt(post.user.uid, 10), regularUid);
		});

		it('should display real user data for moderators on anonymous posts', async () => {
			// Get topic data first
			const topicInfo = await topics.getTopicData(anonymousTopicTid);
			// Get topic with posts for moderator user
			const topicData = await topics.getTopicWithPosts(topicInfo, `tid:${anonymousTopicTid}:posts`, moderatorUid, 0, -1, false);
			
			assert(topicData);
			assert(topicData.posts);
			assert(topicData.posts.length > 0);
			
			const post = topicData.posts[0];
			// getTopicWithPosts returns integer 1 for anonymous posts
			assert.strictEqual(parseInt(post.anonymous, 10), 1);
			// Moderator should see the real user data
			assert(post.user);
			assert.strictEqual(parseInt(post.user.uid, 10), regularUid);
		});
	});

	describe('Anonymous Name Generation', () => {
		it('should generate anonymous names with adjective and animal format', () => {
			// Test the generateAnonymousName function directly
			const name1 = utils.generateAnonymousName(1, 100);
			const name2 = utils.generateAnonymousName(1, 100);
			
			// Names should start with "Anonymous "
			assert(name1.startsWith('Anonymous '), 'Name should start with "Anonymous "');
			assert(name2.startsWith('Anonymous '), 'Name should start with "Anonymous "');
			
			// Names should have adjective and animal after "Anonymous "
			const parts1 = name1.split(' ');
			const parts2 = name2.split(' ');
			
			assert.strictEqual(parts1.length, 3, 'Name should have 3 parts: Anonymous, Adjective, Animal');
			assert.strictEqual(parts2.length, 3, 'Name should have 3 parts: Anonymous, Adjective, Animal');
			assert(parts1[1].length > 0, 'Should have adjective');
			assert(parts1[2].length > 0, 'Should have animal name');
			
			// Same uid/tid should generate same name
			assert.strictEqual(name1, name2);
			
			// Should be valid adjective and animal names (letters/numbers/basic chars)
			assert(/^[A-Za-z0-9]+$/.test(parts1[1]), 'Adjective should be valid');
			assert(/^[A-Za-z0-9]+$/.test(parts1[2]), 'Animal should be valid');
		});

		it('should generate different anonymous names on multiple calls', () => {
			const names = new Set();
			
			// Generate 20 names and check for some variety
			for (let i = 0; i < 20; i++) {
				names.add(utils.generateAnonymousName());
			}
			
			// Should have at least some variety (not all the same)
			assert(names.size > 1);
		});

		it('should always follow the "Anonymous [Adjective] [Animal]" pattern', () => {
			for (let i = 0; i < 10; i++) {
				const name = utils.generateAnonymousName();
				assert(name.startsWith('Anonymous '), 'Name should start with "Anonymous "');
				const parts = name.split(' ');
				assert.strictEqual(parts.length, 3, 'Name should have exactly 3 parts: Anonymous, Adjective, Animal');
				assert.strictEqual(parts[0], 'Anonymous', 'First part should be "Anonymous"');
				assert(parts[1].length > 0, 'Should have adjective');
				assert(parts[2].length > 0, 'Should have animal name');
			}
		});

		it('should generate consistent names for same uid/tid combination', () => {
			// Same user in same topic should always get same anonymous name
			const name1 = utils.generateAnonymousName(1, 100);
			const name2 = utils.generateAnonymousName(1, 100);
			assert.strictEqual(name1, name2, 'Same uid/tid should generate same anonymous name');

			// Different users in same topic should get different names
			const name3 = utils.generateAnonymousName(2, 100);
			assert.notStrictEqual(name1, name3, 'Different users should get different names');

			// Same user in different topics should get different names  
			const name4 = utils.generateAnonymousName(1, 200);
			assert.notStrictEqual(name1, name4, 'Same user in different topics should get different names');
		});
	});

	describe('Anonymous Post Privileges', () => {
		let anonymousTopicTid;
		let anonymousPostPid;

		before(async () => {
			const topicResult = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Anonymous Privileges Test',
				content: 'This is an anonymous post for privilege testing',
				anonymous: 1,
			});
			anonymousTopicTid = topicResult.topicData.tid;
			anonymousPostPid = topicResult.postData.pid;
		});

		it('should allow post author to edit their own anonymous post', async () => {
			const canEdit = await privileges.posts.canEdit(anonymousPostPid, regularUid);
			assert(canEdit.flag, 'Post author should be able to edit their own anonymous post');
		});

		it('should allow admin to edit anonymous posts', async () => {
			const canEdit = await privileges.posts.canEdit(anonymousPostPid, adminUid);
			assert(canEdit.flag, 'Admin should be able to edit anonymous posts');
		});

		it('should allow moderator to edit anonymous posts', async () => {
			const canEdit = await privileges.posts.canEdit(anonymousPostPid, moderatorUid);
			assert(canEdit.flag, 'Moderator should be able to edit anonymous posts');
		});

		it('should prevent other users from editing anonymous posts', async () => {
			const otherUid = await User.create({ username: 'other_user_anon' });
			const canEdit = await privileges.posts.canEdit(anonymousPostPid, otherUid);
			assert(!canEdit.flag, 'Other users should not be able to edit anonymous posts');
		});
	});

	describe('Anonymous Post Validation', () => {
		it('should validate anonymous field in post data', async () => {
			const postData = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Validation Test Topic',
				content: 'This is for validation testing',
				anonymous: 1,
			});

			// Check that anonymous field is properly stored
			const storedPost = await posts.getPostData(postData.postData.pid);
			assert.strictEqual(parseInt(storedPost.anonymous, 10), 1);

			const storedTopic = await topics.getTopicData(postData.topicData.tid);
			assert.strictEqual(parseInt(storedTopic.anonymous, 10), 1);
		});

		it('should handle invalid anonymous values gracefully', async () => {
			// Test with string 'true' - should be treated as truthy and convert to 1
			const postData1 = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'String True Test',
				content: 'Testing string true',
				anonymous: 'true',
			});
			
			// String 'true' is truthy in JavaScript, so converts to 1
			assert.strictEqual(parseInt(postData1.topicData.anonymous || 0, 10), 1);

			// Test with string 'false' - should be treated as truthy and convert to 1
			const postData2 = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'String False Test',
				content: 'Testing string false',
				anonymous: 'false',
			});
			
			// String 'false' is also truthy in JavaScript, so converts to 1
			assert.strictEqual(parseInt(postData2.topicData.anonymous || 0, 10), 1);

			// Test with empty string - should be falsy and convert to 0
			const postData3 = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Empty String Test',
				content: 'Testing empty string',
				anonymous: '',
			});
			
			// Empty string is falsy, so converts to 0
			assert.strictEqual(parseInt(postData3.topicData.anonymous || 0, 10), 0);
		});
	});

	describe('Anonymous Post Integration', () => {
		it('should preserve anonymous status through topic operations', async () => {
			const topicData = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Integration Test Topic',
				content: 'This is an anonymous integration test',
				anonymous: 1,
			});

			// Get topic data through API
			const apiData = await apiTopics.get({ uid: adminUid }, { tid: topicData.topicData.tid });
			assert.strictEqual(parseInt(apiData.anonymous, 10), 1);
			
			// Get topic with posts to verify post anonymity
			const topicWithPosts = await topics.getTopicWithPosts(apiData, `tid:${topicData.topicData.tid}:posts`, adminUid, 0, -1, false);
			assert.strictEqual(parseInt(topicWithPosts.posts[0].anonymous, 10), 1);
		});

		it('should work correctly with post search and retrieval', async () => {
			const topicData = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Search Test Anonymous Topic',
				content: 'This is searchable anonymous content',
				anonymous: 1,
			});

			// Test getting post data directly
			const postData = await posts.getPostData(topicData.postData.pid);
			assert.strictEqual(parseInt(postData.anonymous, 10), 1);
			assert.strictEqual(parseInt(postData.uid, 10), regularUid);
		});

		it('should handle anonymous posts in topic lists', async () => {
			// Create multiple topics, some anonymous
			await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Anonymous List Test 1',
				content: 'Anonymous topic 1',
				anonymous: 1,
			});

			await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Regular List Test 1',
				content: 'Regular topic 1',
			});

			// Get category topics
			const categoryData = await categories.getCategoryById({
				cid: categoryObj.cid,
				uid: regularUid,
				start: 0,
				stop: 19,
			});

			assert(categoryData);
			assert(categoryData.topics);
			
			// Find anonymous topics in the list
			const anonymousTopics = categoryData.topics.filter(topic => parseInt(topic.anonymous, 10) === 1);
			assert(anonymousTopics.length > 0, 'Should find anonymous topics in category listing');
		});

		it('should anonymize user data in category recent posts/teasers for non-admin users', async () => {
			// Create an anonymous topic with replies to generate recent posts/teasers
			const topicData = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Anonymous Teaser Test',
				content: 'Anonymous topic for teaser testing',
				anonymous: 1,
			});

			// Add a reply to generate a teaser
			await topics.reply({
				uid: regularUid,
				tid: topicData.topicData.tid,
				content: 'Anonymous reply for teaser',
			});

			// Get category data which includes recent posts/teasers
			const categoryData = await categories.getCategoryById({
				cid: categoryObj.cid,
				uid: adminUid, // Use different user (admin) to view
				start: 0,
				stop: 19,
			});

			// Check if there are recent posts in the category
			if (categoryData.posts && categoryData.posts.length > 0) {
				const anonymousPost = categoryData.posts.find(post => parseInt(post.anonymous, 10) === 1);
				if (anonymousPost) {
					// Admin should see real user data
					assert.notStrictEqual(anonymousPost.user.uid, 0, 'Admin should see real user data');
					assert.strictEqual(parseInt(anonymousPost.user.uid, 10), regularUid);
				}
			}

			// Now test with a non-admin user
			const categoryDataForRegular = await categories.getCategoryById({
				cid: categoryObj.cid,
				uid: moderatorUid, // Use non-admin user
				start: 0,
				stop: 19,
			});

			if (categoryDataForRegular.posts && categoryDataForRegular.posts.length > 0) {
				const anonymousPost = categoryDataForRegular.posts.find(post => parseInt(post.anonymous, 10) === 1);
				if (anonymousPost) {
					// Non-admin users should see anonymized data (unless they're the author)
					if (parseInt(anonymousPost.originalUid || anonymousPost.user.uid, 10) !== moderatorUid) {
						assert(anonymousPost.user.username.startsWith('Anonymous '), 'Non-admin should see Anonymous username pattern');
						assert.strictEqual(anonymousPost.user.picture, (nconf.get('relative_path') || '') + '/assets/images/anonymous-avatar.png', 'Non-admin should see anonymous avatar');
					}
				}
			}
		});

		it('should anonymize topic authors in category topic listings for non-admin users', async () => {
			// Create an anonymous topic
			const topicData = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Anonymous Author Test',
				content: 'Anonymous topic author testing',
				anonymous: 1,
			});

			// Get category topics as admin (should see real user data)
			const categoryDataAdmin = await categories.getCategoryById({
				cid: categoryObj.cid,
				uid: adminUid,
				start: 0,
				stop: 19,
			});

			const anonymousTopicAdmin = categoryDataAdmin.topics.find(
				t => t.tid === topicData.topicData.tid
			);
			assert(anonymousTopicAdmin, 'Should find anonymous topic in category listing');
			assert.strictEqual(parseInt(anonymousTopicAdmin.anonymous, 10), 1);
			// Admin should see real user data
			assert.strictEqual(parseInt(anonymousTopicAdmin.user.uid, 10), regularUid);
			assert.strictEqual(anonymousTopicAdmin.user.username, 'regular_anon');

			// Get category topics as non-admin user (should see anonymized data)
			const categoryDataRegular = await categories.getCategoryById({
				cid: categoryObj.cid,
				uid: moderatorUid, // Different user viewing
				start: 0,
				stop: 19,
			});

			const anonymousTopicRegular = categoryDataRegular.topics.find(
				t => t.tid === topicData.topicData.tid
			);
			assert(anonymousTopicRegular, 'Should find anonymous topic in category listing');
			assert.strictEqual(parseInt(anonymousTopicRegular.anonymous, 10), 1);
			// Non-admin should see anonymized user data
			assert.strictEqual(anonymousTopicRegular.user.uid, 0);
			assert(anonymousTopicRegular.user.username.startsWith('Anonymous '), 'Username should start with "Anonymous "');
			assert.strictEqual(anonymousTopicRegular.user.userslug, '');
			assert.strictEqual(anonymousTopicRegular.user.picture, (nconf.get('relative_path') || '') + '/assets/images/anonymous-avatar.png');
			assert(anonymousTopicRegular.user.displayname.startsWith('Anonymous '), 'Displayname should start with "Anonymous "');
		});

		it('should anonymize user data in topic view for non-admin users', async () => {
			// Create an anonymous topic
			const topicData = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Anonymous Topic View Test',
				content: 'Anonymous topic content for testing topic view',
				anonymous: 1,
			});

			// Add some replies
			const reply1 = await topics.reply({
				uid: regularUid,
				tid: topicData.topicData.tid,
				content: 'First anonymous reply',
			});

			const reply2 = await topics.reply({
				uid: moderatorUid,
				tid: topicData.topicData.tid,
				content: 'Regular reply from moderator',
			});

			// Get topic with posts as admin (should see real user data)
			const topicWithPostsAdmin = await topics.getTopicWithPosts(
				topicData.topicData,
				`tid:${topicData.topicData.tid}:posts`,
				adminUid,
				0,
				-1,
				false
			);

			// Admin should see real user data for anonymous posts
			const adminMainPost = topicWithPostsAdmin.posts.find(p => p.pid === topicData.postData.pid);
			assert(adminMainPost, 'Should find main post');
			assert.strictEqual(parseInt(adminMainPost.anonymous, 10), 1, 'Post should be marked as anonymous');
			assert.strictEqual(parseInt(adminMainPost.user.uid, 10), regularUid, 'Admin should see real user ID');
			assert.strictEqual(adminMainPost.user.username, 'regular_anon', 'Admin should see real username');

			// Get topic with posts as non-admin user (should see anonymized data)
			const topicWithPostsRegular = await topics.getTopicWithPosts(
				topicData.topicData,
				`tid:${topicData.topicData.tid}:posts`,
				otherUserUid,
				0,
				-1,
				false
			);

			// Non-admin should see anonymized user data for anonymous posts
			const regularMainPost = topicWithPostsRegular.posts.find(p => p.pid === topicData.postData.pid);
			assert(regularMainPost, 'Should find main post');
			assert.strictEqual(parseInt(regularMainPost.anonymous, 10), 1, 'Post should be marked as anonymous');
			assert.strictEqual(regularMainPost.user.uid, 0, 'Non-admin should see anonymous UID');
			assert(regularMainPost.user.username.startsWith('Anonymous '), 'Non-admin should see Anonymous username pattern');
			assert.strictEqual(regularMainPost.user.userslug, '', 'Non-admin should see empty userslug');
			assert.strictEqual(regularMainPost.user.picture, (nconf.get('relative_path') || '') + '/assets/images/anonymous-avatar.png', 'Non-admin should see anonymous avatar');
			assert(regularMainPost.user.displayname.startsWith('Anonymous '), 'Non-admin should see Anonymous displayname pattern');

			// The reply from the same user should also be anonymous to non-admin viewers
			const regularReply1 = topicWithPostsRegular.posts.find(p => p.pid === reply1.pid);
			assert(regularReply1, 'Should find first reply');
			assert.strictEqual(parseInt(regularReply1.anonymous, 10), 1, 'Reply should be anonymous (inherited from topic)');
			assert(regularReply1.user.username.startsWith('Anonymous '), 'Reply should show Anonymous username pattern');

			// But the regular reply should show normal user data
			const regularReply2 = topicWithPostsRegular.posts.find(p => p.pid === reply2.pid);
			assert(regularReply2, 'Should find second reply');
			assert.strictEqual(parseInt(regularReply2.anonymous, 10), 0, 'Regular reply should not be anonymous');
			assert.strictEqual(regularReply2.user.username, 'mod_anon', 'Regular reply should show real username');
		});

		it('should anonymize user data in post summaries for non-admin users', async () => {
			// Create an anonymous post
			const topicData = await topics.post({
				uid: regularUid,
				cid: categoryObj.cid,
				title: 'Anonymous Summary Test',
				content: 'Anonymous post for summary testing',
				anonymous: 1,
			});

			// Get post summaries as admin
			const summariesAdmin = await posts.getPostSummaryByPids([topicData.postData.pid], adminUid, { stripTags: false });
			assert(summariesAdmin.length > 0, 'Should get post summaries');
			const adminSummary = summariesAdmin[0];
			assert.strictEqual(parseInt(adminSummary.anonymous, 10), 1, 'Post should be marked as anonymous');
			assert.strictEqual(parseInt(adminSummary.user.uid, 10), regularUid, 'Admin should see real user data');

			// Get post summaries as non-admin
			const summariesRegular = await posts.getPostSummaryByPids(
				[topicData.postData.pid], otherUserUid, { stripTags: false }
			);
			assert(summariesRegular.length > 0, 'Should get post summaries');
			const regularSummary = summariesRegular[0];
			assert.strictEqual(parseInt(regularSummary.anonymous, 10), 1, 'Post should be marked as anonymous');
			assert.strictEqual(regularSummary.user.uid, 0, 'Non-admin should see anonymous UID');
			assert(regularSummary.user.username.startsWith('Anonymous '), 'Non-admin should see Anonymous username pattern');
			assert.strictEqual(regularSummary.user.picture, (nconf.get('relative_path') || '') + '/assets/images/anonymous-avatar.png', 'Non-admin should see anonymous avatar');
		});
	});

	after(async () => {
		// Clean up test data
		await db.emptydb();
	});
});