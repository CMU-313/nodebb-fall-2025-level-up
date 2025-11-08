'use strict';

const crypto = require('crypto');
const nconf = require('nconf');
const path = require('node:path');

process.profile = function (operation, start) {
	console.log('%s took %d milliseconds', operation, process.elapsedTimeSince(start));
};

process.elapsedTimeSince = function (start) {
	const diff = process.hrtime(start);
	return (diff[0] * 1e3) + (diff[1] / 1e6);
};
const utils = { ...require('../public/src/utils.common') };

utils.getLanguage = function () {
	const meta = require('./meta');
	return meta.config && meta.config.defaultLang ? meta.config.defaultLang : 'en-GB';
};

utils.generateUUID = function () {
	// from https://github.com/tracker1/node-uuid4/blob/master/index.js
	let rnd = crypto.randomBytes(16);
	/* eslint-disable no-bitwise */
	rnd[6] = (rnd[6] & 0x0f) | 0x40;
	rnd[8] = (rnd[8] & 0x3f) | 0x80;
	/* eslint-enable no-bitwise */
	rnd = rnd.toString('hex').match(/(.{8})(.{4})(.{4})(.{4})(.{12})/);
	rnd.shift();
	return rnd.join('-');
};

utils.secureRandom = function (low, high) {
	if (low > high) {
		throw new Error("The 'low' parameter must be less than or equal to the 'high' parameter.");
	}
	const randomBuffer = crypto.randomBytes(4);
	const randomInt = randomBuffer.readUInt32BE(0);
	const range = high - low + 1;
	return low + (randomInt % range);
};

utils.getSass = function () {
	try {
		const sass = require('sass-embedded');
		return sass;
	} catch (err) {
		console.error(err.message);
		return require('sass');
	}
};

utils.getFontawesomePath = function () {
	let packageName = '@fortawesome/fontawesome-free';
	if (nconf.get('fontawesome:pro') === true) {
		packageName = '@fortawesome/fontawesome-pro';
	}
	const pathToMainFile = require.resolve(packageName);
	// main file will be in `js/fontawesome.js` - we need to go up two directories to get to the root of the package
	const fontawesomePath = path.dirname(path.dirname(pathToMainFile));
	return fontawesomePath;
};

utils.getFontawesomeStyles = function () {
	let styles = nconf.get('fontawesome:styles') || '*';
	// "*" is a special case, it means all styles, spread is used to support both string and array (["*"])
	if ([...styles][0] === '*') {
		styles = ['solid', 'brands', 'regular'];
		if (nconf.get('fontawesome:pro')) {
			styles.push('light', 'thin', 'sharp', 'duotone');
		}
	}
	if (!Array.isArray(styles)) {
		styles = [styles];
	}
	return styles;
};

utils.getFontawesomeVersion = function () {
	const fontawesomePath = utils.getFontawesomePath();
	const packageJson = require(path.join(fontawesomePath, 'package.json'));
	return packageJson.version;
};

utils.generateAnonymousName = function (uid, tid) {
	// Load adjectives and animals from JSON file (similar to how language files are loaded)
	let adjectives, animals;
	try {
		const data = require('./animals.json');
		adjectives = data.adjectives || [];
		animals = data.animals || [];
	} catch (err) {
		// Fallback to basic sets if file doesn't exist
		adjectives = [
			'Swift', 'Brave', 'Clever', 'Noble', 'Fierce',
			'Gentle', 'Mighty', 'Wise', 'Bold', 'Calm',
			'Quick', 'Strong', 'Silent', 'Bright', 'Dark',
			'Golden', 'Silver', 'Crimson', 'Azure', 'Emerald',
		];
		animals = [
			'Fox', 'Panda', 'Tiger', 'Owl', 'Dolphin',
			'Hedgehog', 'Falcon', 'Penguin', 'Wolf', 'Koala',
			'Rabbit', 'Eagle', 'Lion', 'Bear', 'Giraffe',
			'Zebra', 'Cheetah', 'Leopard', 'Kangaroo', 'Elephant',
			'Phoenix', 'Dragon', 'Unicorn', 'Griffin', 'Hydra',
		];
	}
	
	// If uid and tid are provided, generate consistent name based on them
	if (uid && tid) {
		// Create a string-based hash for better distribution
		const str = `${uid}_${tid}`;
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = ((hash * 31) + str.charCodeAt(i)) % 1000000;
		}
		
		// Use different parts of the hash for adjective and animal
		const adjIndex = Math.abs(hash) % adjectives.length;
		const animalIndex = Math.abs(Math.floor(hash / adjectives.length)) % animals.length;
		
		const adjective = adjectives[adjIndex];
		const animal = animals[animalIndex];
		return `Anonymous ${adjective} ${animal}`;
	}
	
	// Fallback to random for backward compatibility
	const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
	const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
	return `Anonymous ${randomAdj} ${randomAnimal}`;
};

module.exports = utils;
