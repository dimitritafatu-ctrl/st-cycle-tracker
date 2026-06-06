const {
    extensionSettings,
    saveSettingsDebounced,
    renderExtensionTemplateAsync,
    eventSource,
    event_types,
    substituteParams, // Added for dynamic name resolution
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
    'Menstruation': { label: 'Менструация', icon: 'fa-droplet', color: '#ff4d4d' },
    'Follicular': { label: 'Фолликулярная фаза', icon: 'fa-seedling', color: '#4dff88' },
    'Ovulation': { label: 'Овуляция', icon: 'fa-egg', color: '#ffff4d' },
    'Luteal': { label: 'Лютеиновая фаза', icon: 'fa-sun', color: '#ffad33' }
};

function initSettings() {
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = { ...DEFAULT_SETTINGS };
    } else {
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
    let visualHtml = '';
    let statusColor = 'var(--mainColor)';

    if (settings.isPregnant) {
        const conceptionDate = new Date(settings.conceptionDate);
        const diffWeeks = Math.floor((now - conceptionDate) / (1000 * 60 * 60 * 24 * 7));
        const gender = settings.pregnancyData.gender;
        const count = settings.pregnancyData.count;
        
        const genderText = gender === 'Boy' ? 'Мальчик' : (gender === 'Girl' ? 'Девочка' : 'Разные');
        const countText = count === 1 ? 'один ребёнок' : (count === 2 ? 'близнецы' : 'тройня');
        
        statusText = `Беременность: ${diffWeeks} нед. (${countText}, ${genderText})`;
        
        const genderClass = gender === 'Boy' ? 'gender-boy' : (gender === 'Girl' ? 'gender-girl' : 'gender-mixed');
        const babyIcon = `<i class="fa-solid fa-baby ${genderClass}"></i>`;
        visualHtml = babyIcon.repeat(count);
        statusColor = gender === 'Boy' ? '#89CFF0' : (gender === 'Girl' ? '#F4C2C2' : 'var(--mainColor)');
    } else if (settings.lastPeriodDate) {
        const phaseKey = getCyclePhase(now);
        const phase = PHASES[phaseKey];
        if (phase) {
            statusText = `Фаза: ${phase.label}`;
            visualHtml = `<i class="fa-solid ${phase.icon}" style="color: ${phase.color}"></i>`;
            statusColor = phase.color;
        } else {
            statusText = 'Нет данных';
            visualHtml = '<i class="fa-solid fa-circle-question"></i>';
        }
    } else {
        statusText = 'Требуется настройка';
        visualHtml = '<i class="fa-solid fa-gear"></i>';
    }

    $('#st_cycle_tracker_status').text(statusText).css('color', statusColor);
    $('#st_cycle_tracker_visual').html(visualHtml);
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
        toastr.info('Система: Произошло зачатие! Поздравляем!');
    }
}

async function initUI() {
    let html = await renderExtensionTemplateAsync('third-party/st-cycle-tracker', 'settings');
    
    // Replace {{user}} dynamically
    if (typeof substituteParams === 'function') {
        html = substituteParams(html);
    }

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
        toastr.success('Цикл обновлен!');
    });

    $('#st_cycle_tracker_reset').on('click', () => {
        settings.isPregnant = false;
        settings.conceptionDate = null;
        saveSettingsDebounced();
        updateUI();
        toastr.warning('Данные о беременности сброшены.');
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
