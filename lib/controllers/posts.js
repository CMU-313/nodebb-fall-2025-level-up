'use strict';

const nconf = require('nconf');
const querystring = require('querystring');

const meta = require('../meta');
const posts = require('../posts');
const privileges = require('../privileges');
const activitypub = require('../activitypub');
const utils = require('../utils');

const helpers = require('./helpers');

const postsController = module.exports;

postsController.redirectToPost = async function (req, res, next) {
	/* ChatGPT */
	try {
		const pid = parsePid(req.params.pid);
		if (!pid) return next();

		await maybeAssertActivityPubNote(pid, req);

		const resolved = await getAccessAndPath(pid, req.uid);
		if (!resolved.path) return next();
		if (!resolved.canRead) return helpers.notAllowed(req, res);

		maybeSetActivityPubLinkHeader(res, req);

		const url = buildRedirectUrl(resolved.path, req.query);
		// TEMP proof for P1B — remove before commit
		// console.log('Misty Fan', { pid: req.params.pid, uid: req.uid });

		return helpers.redirect(res, url, true);
	} catch (err) {
		return next(err);
	}
};

/* ---------------- file-local helpers - ChatGPT ---------------- */

function parsePid(rawPid) {
	return utils.isNumber(rawPid) ? parseInt(rawPid, 10) : rawPid;
}

async function maybeAssertActivityPubNote(pid, req) {
	// Kickstart note assertion if applicable (same logic, just isolated)
	if (!utils.isNumber(pid) && req.uid && meta.config.activitypubEnabled) {
		const exists = await posts.exists(pid);
		if (!exists) {
			await activitypub.notes.assert(req.uid, pid);
		}
	}
}

async function getAccessAndPath(pid, uid) {
	const [canRead, path] = await Promise.all([
		privileges.posts.can('topics:read', pid, uid),
		posts.generatePostPath(pid, uid),
	]);
	return { canRead, path };
}

function maybeSetActivityPubLinkHeader(res, req) {
	if (meta.config.activitypubEnabled) {
		res.set(
			'Link',
			`<${nconf.get('url')}/post/${req.params.pid}>; rel="alternate"; type="application/activity+json"`
		);
	}
}

function buildRedirectUrl(path, query) {
	const qs = querystring.stringify(query);
	return qs ? `${path}?${qs}` : path;
}

postsController.getRecentPosts = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const postsPerPage = 20;
	const start = Math.max(0, (page - 1) * postsPerPage);
	const stop = start + postsPerPage - 1;
	const data = await posts.getRecentPosts(req.uid, start, stop, req.params.term);
	res.json(data);
};
