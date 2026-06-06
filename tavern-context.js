export function getContext() {
    return typeof SillyTavern !== 'undefined' && SillyTavern.getContext ? SillyTavern.getContext() : window;
}

export const tavern = {
    get extension_settings() { return getContext().extensionSettings || getContext().extension_settings || {}; },
    get eventSource() { return getContext().eventSource; },
    get event_types() { return getContext().event_types; },
    get extension_prompt_types() { return getContext().extension_prompt_types; },
    saveSettingsDebounced() { 
        const ctx = getContext();
        if (ctx && ctx.saveSettingsDebounced) ctx.saveSettingsDebounced(); 
    },
    setExtensionPrompt(name, prompt, type, position) {
        const ctx = getContext();
        if (ctx && ctx.setExtensionPrompt) ctx.setExtensionPrompt(name, prompt, type, position);
    }
};
