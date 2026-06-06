// ═══════════════════════════════════════════
// STATE — доступ к настройкам и данным
// ═══════════════════════════════════════════

import { tavern } from './tavern-context.js';
const { extension_settings } = tavern;
import { extensionName, defaultPregnancyData, LANG } from './config.js';

export function getSettings() {
    return extension_settings[extensionName];
}

export function getCurrentChatId() {
    try {
        const context = typeof SillyTavern?.getContext === 'function' 
            ? SillyTavern.getContext() 
            : window;
        return context?.chatId || context?.chat_metadata?.chat_id || null;
    } catch (e) {
        return null;
    }
}

export function getPregnancyData() {
    const s = getSettings();
    const chatId = getCurrentChatId();
    
    if (!chatId) {
        if (!s._tempPregnancyData) {
            s._tempPregnancyData = structuredClone(defaultPregnancyData);
        }
        return s._tempPregnancyData;
    }

    if (!s.chatPregnancyData) {
        s.chatPregnancyData = {};
    }

    if (!s.chatPregnancyData[chatId]) {
        s.chatPregnancyData[chatId] = JSON.parse(JSON.stringify(defaultPregnancyData));
    }
    
    return s.chatPregnancyData[chatId];
}

export function L(key) {
    try {
        const s = getSettings();
        const lang = s?.language || 'ru';
        const keys = key.split('.');
        let result = LANG[lang];
        for (const k of keys) {
            result = result?.[k];
        }
        return result || key;
    } catch (e) {
        console.error('[Reproductive] L() error:', key, e);
        return key;
    }
}
