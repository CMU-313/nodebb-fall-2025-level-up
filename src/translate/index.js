/* eslint-disable strict */

const translatorApi = module.exports;

translatorApi.translate = async function (postData) {
	const TRANSLATOR_API = process.env.TRANSLATOR_API || 'http://127.0.0.1:5000';

	try {
		const response = await fetch(`${TRANSLATOR_API}/?content=${encodeURIComponent(postData.content)}`);
		const data = await response.json();

		console.log('[translator] sending to:', `${TRANSLATOR_API}/?content=${postData.content}`);
		// Flask returns {"is_english": bool, "translated_content": string}
		return [data.is_english, data.translated_content];
	} catch (err) {
		console.error('Translation API error:', err);
		// fallback: assume English, no translation
		return [true, ''];
	}
};

// translatorApi.translate = async function (postData) {
//  Edit the translator URL below
//  const TRANSLATOR_API = "TODO"
//  const response = await fetch(TRANSLATOR_API+'/?content='+postData.content);
//  const data = await response.json();
//  return ['is_english','translated_content'];
// };