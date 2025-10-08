'use strict';

const privileges = require('../privileges');

async function filterVisibleTopics(topics, uid) {
	if (!Array.isArray(topics) || !topics.length) {
		return [];
	}

	const visibility = await Promise.all(topics.map(async (t) => {
		// Always show if not private
		if (parseInt(t.private, 10) !== 1) {
			return true;
		}
		// Otherwise, only staff or admin can view
		return uid ? privileges.topics.isAdminOrMod(t.tid, uid) : false;
	}));

	return topics.filter((t, idx) => visibility[idx]);
}

module.exports = { filterVisibleTopics };