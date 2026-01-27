// Neurovia Music - Language Manager
const tr = require('./tr');
const en = require('./en');

const languages = { tr, en };
const defaultLang = 'tr';

/**
 * Get localized string with optional variable replacement
 * @param {string} key - Translation key
 * @param {string} lang - Language code (tr/en)
 * @param {Object} vars - Variables to replace in string
 * @returns {string} Localized string
 */
function t(key, lang = defaultLang, vars = {}) {
    const langData = languages[lang] || languages[defaultLang];
    let text = langData[key] || languages[defaultLang][key] || key;

    // Replace variables like {name} with actual values
    for (const [varKey, value] of Object.entries(vars)) {
        text = text.replace(new RegExp(`{${varKey}}`, 'g'), value);
    }

    return text;
}

/**
 * Get language preference for user/guild
 * For now, returns default. Can be extended to check user/guild settings
 */
function getLang(guildId) {
    // Future: Check guild settings in DB
    return defaultLang;
}

module.exports = { t, getLang, languages, defaultLang };
