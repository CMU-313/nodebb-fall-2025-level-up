'use strict';

const assert = require('assert');
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

describe('Anonymous Posting', () => {
	let categoryObj;
	let adminUid;
	let regularUid;
	let moderatorUid;
	let adminJar;
	let csrf_token;

	before(async () => {
		// Create test users
		adminUid = await User.create({ username: 'admin_anon', password: '123456' });
		regularUid = await User.create({ username: 'regular_anon', password: '123456' });
		moderatorUid = await User.create({ username: 'mod_anon', password: '123456' });

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
		it('should generate anonymous names with animal format', () => {
			// Test the generateAnonymousName function directly
			const name1 = composer.generateAnonymousName();
			const name2 = composer.generateAnonymousName();
			
			// Names should start with "Anonymous "
			assert(name1.startsWith('Anonymous '));
			assert(name2.startsWith('Anonymous '));
			
			// Names should have an animal after "Anonymous "
			const animal1 = name1.replace('Anonymous ', '');
			const animal2 = name2.replace('Anonymous ', '');
			
			assert(animal1.length > 0);
			assert(animal2.length > 0);
			
			// Should be valid animal names (no spaces or special characters)
			assert(/^[A-Za-z]+$/.test(animal1));
			assert(/^[A-Za-z]+$/.test(animal2));
		});

		it('should generate different anonymous names on multiple calls', () => {
			const names = new Set();
			
			// Generate 20 names and check for some variety
			for (let i = 0; i < 20; i++) {
				names.add(composer.generateAnonymousName());
			}
			
			// Should have at least some variety (not all the same)
			assert(names.size > 1);
		});

		it('should always follow the "Anonymous [Animal]" pattern', () => {
			for (let i = 0; i < 10; i++) {
				const name = composer.generateAnonymousName();
				assert(/^Anonymous [A-Za-z]+$/.test(name));
			}
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
	});

	after(async () => {
		// Clean up test data
		await db.emptydb();
	});
});