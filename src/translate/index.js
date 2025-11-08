/* eslint-disable strict */

const translatorApi = module.exports;

translatorApi.translate = async function (postData) {
	const TRANSLATOR_API = process.env.TRANSLATOR_API || 'http://127.0.0.1:8080';

	try {
		const url = `${TRANSLATOR_API}/?content=${encodeURIComponent(postData.content)}`;
		console.log('[translator] sending to:', url);

		const response = await fetch(url);
		const data = await response.json();

		const isEnglish = Boolean(data.is_english);
		let translatedContent = data.translated_content;

		if (typeof translatedContent !== 'string') {
			try {
				translatedContent = JSON.stringify(translatedContent);
			} catch {
				translatedContent = String(translatedContent);
			}
		}

		return [isEnglish, translatedContent];
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