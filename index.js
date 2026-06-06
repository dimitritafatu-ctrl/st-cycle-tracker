const {
    extensionSettings,
    saveSettingsDebounced,
    renderExtensionTemplateAsync,
    eventSource,
    event_types,
} = SillyTavern.getContext();

const MODULE_NAME = 'st_cycle_tracker';
const DEFAULT_SETTINGS = {
    enabled: true,
    lastPeriodDate: null,
    cycleLength: 28,
    hasFemaleGenitalia: true,
    isPregnant: false,
    conceptionDate: null,
    autoConception: false,
    conceptionChance: 5, // 5% chance per message during ovulation
    pregnancyData: {
        weeks: 0,
        gender: null,
        count: 1
    }
};

const PHASES = {
    'Menstruation': 'Менструация',
    'Follicular': 'Фолликулярная фаза',
    'Ovulation': 'Овуляция',
    'Luteal': 'Лютеиновая фаза'
};

function initSettings() {
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = { ...DEFAULT_SETTINGS };
    } else {
        // Merge settings to ensure new defaults are present
        extensionSettings[MODULE_NAME] = Object.assign({}, DEFAULT_SETTINGS, extensionSettings[MODULE_NAME]);
    }
}

function getCyclePhase(date) {
    const settings = extensionSettings[MODULE_NAME];
    if (!settings.lastPeriodDate || settings.isPregnant) return null;

    const lastPeriod = new Date(settings.lastPeriodDate);
    const diffTime = Math.abs(date - lastPeriod);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) % settings.cycleLength;

    if (diffDays < 5) return 'Menstruation';
    if (diffDays < 12) return 'Follicular';
    if (diffDays < 17) return 'Ovulation';
    return 'Luteal';
}

function updateUI() {
    const settings = extensionSettings[MODULE_NAME];
    const now = new Date();
    
    let statusText = '';
    if (settings.isPregnant) {
        const conceptionDate = new Date(settings.conceptionDate);
        const diffWeeks = Math.floor((now - conceptionDate) / (1000 * 60 * 60 * 24 * 7));
        const genderText = settings.pregnancyData.gender === 'Boy' ? 'Мальчик' : (settings.pregnancyData.gender === 'Girl' ? 'Девочка' : 'Разные');
        const countText = settings.pregnancyData.count === 1 ? 'один ребёнок' : 
                          (settings.pregnancyData.count === 2 ? 'близнецы' : 'тройня');
        
        statusText = `Беременность: ${diffWeeks} нед. (${countText}, ${genderText})`;
    } else if (settings.lastPeriodDate) {
        const phase = getCyclePhase(now);
        statusText = `Фаза: ${PHASES[phase] || phase}`;
    } else {
        statusText = 'Нет данных';
    }

    $('#st_cycle_tracker_status').text(statusText);
}

function rollForPregnancy() {
    const settings = extensionSettings[MODULE_NAME];
    if (!settings.enabled || !settings.hasFemaleGenitalia || settings.isPregnant) return;

    const phase = getCyclePhase(new Date());
    if (phase !== 'Ovulation') return;

    const roll = Math.random() * 100;
    if (roll < settings.conceptionChance) {
        const genderRoll = Math.random() > 0.5 ? 'Boy' : 'Girl';
        const countRoll = Math.random() > 0.95 ? (Math.random() > 0.9 ? 3 : 2) : 1;
        
        // For twins/triplets, gender can be mixed
        let finalGender = genderRoll;
        if (countRoll > 1 && Math.random() > 0.5) {
            finalGender = 'Mixed';
        }

        extensionSettings[MODULE_NAME].isPregnant = true;
        extensionSettings[MODULE_NAME].conceptionDate = new Date().toISOString();
        extensionSettings[MODULE_NAME].pregnancyData = {
            weeks: 0,
            gender: finalGender,
            count: countRoll
        };
        saveSettingsDebounced();
        updateUI();
        toastr.info('Система: Произошло зачатие!');
    }
}

async function initUI() {
    const html = await renderExtensionTemplateAsync('third-party/st-cycle-tracker', 'settings');
    $('#extensions_settings2').append(html);

    const settings = extensionSettings[MODULE_NAME];

    $('#st_cycle_tracker_enable').prop('checked', settings.enabled);
    $('#st_cycle_tracker_enable').on('change', function() {
        settings.enabled = $(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#st_cycle_tracker_female').prop('checked', settings.hasFemaleGenitalia);
    $('#st_cycle_tracker_female').on('change', function() {
        settings.hasFemaleGenitalia = $(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#st_cycle_tracker_auto').prop('checked', settings.autoConception);
    $('#st_cycle_tracker_auto').on('change', function() {
        settings.autoConception = $(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#st_cycle_tracker_set_period').on('click', () => {
        settings.lastPeriodDate = new Date().toISOString();
        settings.isPregnant = false;
        saveSettingsDebounced();
        updateUI();
    });

    $('#st_cycle_tracker_reset').on('click', () => {
        settings.isPregnant = false;
        settings.conceptionDate = null;
        saveSettingsDebounced();
        updateUI();
    });

    updateUI();
}

jQuery(async () => {
    initSettings();
    await initUI();
    
    eventSource.on(event_types.MESSAGE_RECEIVED, () => {
        if (extensionSettings[MODULE_NAME].autoConception) {
            rollForPregnancy();
        }
    });

    setInterval(updateUI, 60000);
});
