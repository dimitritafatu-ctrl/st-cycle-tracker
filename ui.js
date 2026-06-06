// ═══════════════════════════════════════════
// UI — панель настроек и мониторинг
// ═══════════════════════════════════════════

import { saveSettingsDebounced } from '../../../../script.js';
import { getSettings, getPregnancyData, L } from './state.js';
import { getPhaseInfo, calculateWeeksFromDates, getSymptomsForProgress, getRecommendationsForProgress, getFetusSizeForProgress, formatSexIcons, formatFetusCount, getHealthInfo, roll } from './helpers.js';
import { calculateDueDate, calculateConceptionDate } from './date-parser.js';
import { resetPregnancy, visitDoctor } from './pregnancy.js';
import { updatePromptInjection } from './prompts.js';
import { showNotification } from './notifications.js';

export function syncUI() {
    const s = getSettings();
    const p = getPregnancyData();

    const enabled = document.getElementById('repro-enabled');
    const notify = document.getElementById('repro-notify');
    if (enabled) enabled.checked = s.isEnabled;
    if (notify) notify.checked = s.showNotifications;

    const contraSelect = document.getElementById('repro-contraception');
    if (contraSelect) contraSelect.value = s.contraception;

    // Синхронизация срока беременности
    const durationSelect = document.getElementById('repro-duration');
    const durationCustom = document.getElementById('repro-duration-custom');
    const manualDuration = document.getElementById('repro-manual-duration');
    if (durationSelect) {
        const dur = s.pregnancyDuration || 40;
        const standardValues = ['12', '16', '20', '24', '28', '32', '36', '40'];
        if (standardValues.includes(String(dur))) {
            durationSelect.value = String(dur);
            if (durationCustom) durationCustom.style.display = 'none';
        } else {
            durationSelect.value = 'custom';
            if (durationCustom) {
                durationCustom.style.display = 'inline-block';
                durationCustom.value = dur;
            }
        }
    }
    if (manualDuration) manualDuration.value = s.pregnancyDuration || 40;

    const cycleInput = document.getElementById('repro-cycleday');
    const currentCycle = document.getElementById('repro-currentcycle');

    if (cycleInput) cycleInput.value = s.cycleDay;

    if (currentCycle) {
        const day = s.cycleDay;
        const phaseInfo = getPhaseInfo(day);
        currentCycle.innerHTML = `<i class="fa-solid ${phaseInfo.icon}" style="color: ${phaseInfo.color};"></i> <strong>${day}</strong>/28 — ${phaseInfo.name}`;
    }

    const status = document.getElementById('repro-status');
    if (status) {
        if (p.isPregnant) {
            status.innerHTML = `<span style="color: #ff9ff3;"><i class="fa-solid fa-person-pregnant"></i> ${L('pregnant')}</span>`;
        } else {
            status.innerHTML = `<span style="opacity: 0.7;">${L('notPregnant')}</span>`;
        }
    }

    const monitorBlock = document.getElementById('repro-pregnancy-monitor');
    const monitorContent = document.getElementById('repro-pregnancy-content');

    if (monitorBlock && monitorContent) {
        if (p.isPregnant && (p.pregnancyWeeks > 0 || p.conceptionDate)) {
            monitorBlock.style.display = 'block';

            const { weeks, days } = calculateWeeksFromDates(p.conceptionDate, p.rpDate, p.pregnancyWeeks);

            let dueDateStr = '—';
            if (p.conceptionDate) {
                const dueDate = calculateDueDate(p.conceptionDate);
                if (dueDate) {
                    dueDateStr = dueDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
                }
            }

            const duration = s.pregnancyDuration || 40;
            const progressPercent = Math.min(100, Math.round((weeks / duration) * 100));
            const sexIcons = formatSexIcons(p.fetusSex);
            const fetusText = formatFetusCount(p.fetusCount);

            const fetusSize = getFetusSizeForProgress(progressPercent, true);

            let symptoms = '';
            let recommendations = '';

            symptoms = getSymptomsForProgress(progressPercent, weeks);
            recommendations = getRecommendationsForProgress(progressPercent);

            const health = getHealthInfo(p.healthStatus);
            const healthIcon = health.emoji;
            const healthText = health.text;
            const healthColor = health.color;

            let riskFactors = [];
            if (p.fetusCount >= 2) riskFactors.push('Многоплодная');
            if (weeks > duration) riskFactors.push('Перенашивание');
            if (p.complications.length > 2) riskFactors.push('Множественные осложнения');

            const riskHTML = riskFactors.length > 0 
                ? `<div class="pregnancy-info-row"><span class="pregnancy-info-label"><i class="fa-solid fa-triangle-exclamation"></i> Риски:</span><span class="pregnancy-info-value" style="color: #ffaa00; font-size: 11px;">${riskFactors.join(', ')}</span></div>`
                : '';

            let complicationsHTML = '';
            const unresolvedCount = p.complications ? p.complications.filter(c => !c.resolved).length : 0;
            
            if (p.complications && p.complications.length > 0) {
                const recent = p.complications.slice(-3).reverse();
                complicationsHTML = `<div class="pregnancy-complications"><div class="pregnancy-complications-title"><i class="fa-solid fa-clipboard-list"></i> Осложнения:</div>${recent.map(c => {
                    const col = c.resolved ? '#888' : (c.severity === 'critical' ? '#ff4444' : '#ffaa00');
                    const ico = c.resolved ? '✅' : (c.severity === 'critical' ? '🚨' : '⚠️');
                    const resolvedStyle = c.resolved ? 'text-decoration: line-through; opacity: 0.5;' : '';
                    return `<div class="complication-item" style="${resolvedStyle}"><span style="color: ${col};">${ico}</span> <strong>${c.type}</strong> <span style="opacity: 0.5; font-size: 10px;">(${c.week} нед.)${c.resolved ? ' — вылечено' : ''}</span><div style="font-size: 11px; opacity: 0.7;">${c.description}</div></div>`;
                }).join('')}`;
                
                // Кнопка "К врачу" если есть нерешённые осложнения
                if (unresolvedCount > 0) {
                    complicationsHTML += `<button id="repro-doctor-btn" class="menu_button" style="margin-top: 10px; width: 100%; background: linear-gradient(135deg, #4dabf7 0%, #228be6 100%);"><i class='fa-solid fa-hospital'></i> К врачу (${unresolvedCount} осложн.)</button>`;
                }
                
                complicationsHTML += `</div>`;
            }

            monitorContent.innerHTML = `
                <div class="pregnancy-info-row"><span class="pregnancy-info-label"><i class="fa-solid fa-hourglass-half"></i> Срок:</span><span class="pregnancy-info-value">${weeks}/${duration} нед. (${days} дн.)</span></div>
                <div class="pregnancy-info-row"><span class="pregnancy-info-label"><i class="fa-regular fa-calendar-check"></i> ПДР:</span><span class="pregnancy-info-value">${dueDateStr}</span></div>
                <div class="pregnancy-info-row"><span class="pregnancy-info-label"><i class="fa-solid fa-baby"></i> Плод:</span><span class="pregnancy-info-value">${fetusText} ${sexIcons}</span></div>
                <div class="pregnancy-info-row"><span class="pregnancy-info-label"><i class="fa-solid fa-ruler"></i> Размер:</span><span class="pregnancy-info-value" style="font-size: 11px;">${fetusSize}</span></div>
                <div class="pregnancy-info-row"><span class="pregnancy-info-label"><i class="fa-solid fa-heart-pulse"></i> Здоровье:</span><span class="pregnancy-info-value" style="color: ${healthColor};">${healthIcon} ${healthText}</span></div>
                ${riskHTML}
                <div class="pregnancy-progress-bar"><div class="pregnancy-progress-fill" style="width: ${progressPercent}%"></div></div>
                <div style="text-align: center; font-size: 11px; opacity: 0.7; margin-bottom: 10px;">${progressPercent}% до родов</div>
                <div class="pregnancy-symptoms"><div class="pregnancy-symptoms-title"><i class="fa-solid fa-stethoscope"></i> Симптомы:</div><div class="pregnancy-symptoms-text">${symptoms}</div></div>
                <div class="pregnancy-recommendations"><div class="pregnancy-recommendations-title"><i class="fa-solid fa-lightbulb"></i> Рекомендации:</div><div class="pregnancy-recommendations-text">${recommendations}</div></div>
                ${complicationsHTML}
            `;
            
            // Привязываем обработчик для кнопки "К врачу"
            setTimeout(() => {
                const doctorBtn = document.getElementById('repro-doctor-btn');
                if (doctorBtn) {
                    doctorBtn.onclick = visitDoctor;
                }
            }, 10);
        } else {
            monitorBlock.style.display = 'none';
        }
    }

    const resetBtn = document.getElementById('repro-reset');
    if (resetBtn) {
        resetBtn.style.display = p.isPregnant ? 'block' : 'none';
    }

    const stats = document.getElementById('repro-stats');
    if (stats) {
        stats.textContent = `${L('stats').replace('{checks}', s.totalChecks).replace('{conceptions}', s.totalConceptions)}`;
    }
}

export async function setupUI() {
    try {
        const s = getSettings();
        
        let html = '';
        if (typeof SillyTavern?.getContext === 'function') {
            html = await SillyTavern.getContext().renderExtensionTemplateAsync('third-party/st-cycle-tracker', 'settings');
        } else {
            console.error('[Reproductive] Context not available for template rendering');
            return;
        }

        $('#extensions_settings2').append(html);

        $('#repro-enabled').on('change', function() {
            getSettings().isEnabled = this.checked;
            saveSettingsDebounced();
            updatePromptInjection();
        });

        $('#repro-notify').on('change', function() {
            getSettings().showNotifications = this.checked;
            saveSettingsDebounced();
        });

        $('#repro-mode').on('change', function() {
            getSettings().mode = this.value;
            saveSettingsDebounced();
            updatePromptInjection();
        });

        $('#repro-gender').on('change', function() {
            getSettings().userGender = this.value;
            saveSettingsDebounced();
            updatePromptInjection();
        });

        $('#repro-contraception').on('change', function() {
            getSettings().contraception = this.value;
            saveSettingsDebounced();
            updatePromptInjection();
            syncUI();
        });

        $('#repro-setcycle').on('click', function() {
            const input = document.getElementById('repro-cycleday');
            const value = Math.max(1, Math.min(28, parseInt(input.value) || 14));
            input.value = value;
            const s = getSettings();
            s.cycleDay = value;
            s.lastCycleUpdate = Date.now();
            saveSettingsDebounced();
            setTimeout(() => {
                updatePromptInjection();
                syncUI();
                showNotification(`День цикла: ${value}`, 'info');
            }, 100);
        });

        $('#repro-toggle-manual').on('click', function() {
            const manualDiv = $('#repro-manual-pregnancy');
            manualDiv.is(':visible') ? manualDiv.slideUp(200) : manualDiv.slideDown(200);
        });

        // Обработчик выбора срока беременности
        $('#repro-duration').on('change', function() {
            const s = getSettings();
            const val = $(this).val();
            if (val === 'custom') {
                $('#repro-duration-custom').show().focus();
            } else {
                $('#repro-duration-custom').hide();
                s.pregnancyDuration = parseInt(val);
                saveSettingsDebounced();
                updatePromptInjection();
                syncUI();
                showNotification(`Срок беременности: ${val} недель`, 'info');
            }
        });

        $('#repro-duration-custom').on('change', function() {
            const s = getSettings();
            const val = Math.max(4, Math.min(100, parseInt($(this).val()) || 40));
            $(this).val(val);
            s.pregnancyDuration = val;
            saveSettingsDebounced();
            updatePromptInjection();
            syncUI();
            showNotification(`Срок беременности: ${val} недель`, 'info');
        });

        $('#repro-setpregnant').on('click', function() {
            const s = getSettings();
            const p = getPregnancyData();
            const count = parseInt($('#repro-manual-count').val());
            const duration = Math.max(4, Math.min(100, parseInt($('#repro-manual-duration').val()) || 40));
            const weeks = Math.max(0, Math.min(duration, parseInt($('#repro-manual-weeks').val()) || 1));
            const rpDateInput = $('#repro-manual-rpdate').val();

            // Устанавливаем срок беременности
            s.pregnancyDuration = duration;

            p.isPregnant = true;
            p.pregnancyWeeks = weeks;
            p.fetusCount = count;
            p.fetusSex = [];

            if (rpDateInput) {
                p.rpDate = new Date(rpDateInput).toISOString();
                const conceptionDate = calculateConceptionDate(new Date(p.rpDate), weeks);
                p.conceptionDate = conceptionDate ? conceptionDate.toISOString() : new Date().toISOString();
            } else {
                p.rpDate = new Date().toISOString();
                p.conceptionDate = new Date().toISOString();
            }

            for (let i = 0; i < count; i++) {
                p.fetusSex.push(roll(2) === 1 ? 'M' : 'F');
            }

            saveSettingsDebounced();
            updatePromptInjection();
            syncUI();

            showNotification(`🤰 Беременность установлена!\n${weeks}/${duration} нед. | ${formatFetusCount(count)} | Пол: ${formatSexIcons(p.fetusSex)}`, 'success');

            $('#repro-manual-pregnancy').slideUp(200);
        });

        $('#repro-reset').on('click', function() {
            if (confirm('Сбросить беременность?')) {
                resetPregnancy();
                showNotification('Беременность сброшена', 'info');
            }
        });

        syncUI();

    } catch (error) {
        console.error('[Reproductive] setupUI error:', error);
    }
}

nual-pregnancy').slideUp(200);
        });

        $('#repro-reset').on('click', function() {
            if (confirm('Сбросить беременность?')) {
                resetPregnancy();
                showNotification('Беременность сброшена', 'info');
            }
        });

        syncUI();

    } catch (error) {
        console.error('[Reproductive] setupUI error:', error);
    }
}

