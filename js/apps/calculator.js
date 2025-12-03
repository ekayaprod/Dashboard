// ============================================================================
// PAGE-SPECIFIC LOGIC: Calculator (calculator.html)
// ============================================================================

AppLifecycle.onBootstrap(initializePage);

function initializePage() {
    const APP_CONFIG = {
        NAME: 'calculator',
        VERSION: '2.0.7',
        DATA_KEY: 'eod_targets_state_v1',
        IMPORT_KEY: 'eod_targets_import_minutes'
    };

    // ============================================================================
    // INITIALIZATION ROUTINE
    // ============================================================================
    (async () => {
        try {
            if (typeof SafeUI === 'undefined' || !SafeUI.isReady || typeof DOMHelpers === 'undefined' || typeof UIPatterns === 'undefined' || typeof SharedSettingsModal === 'undefined' || typeof BackupRestore === 'undefined') {
                const banner = document.getElementById('app-startup-error');
                if (banner) {
                    banner.innerHTML = `<strong>Application Failed to Load</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">Critical dependencies (UI, Data, or Settings) missing.</p>`;
                    banner.classList.remove('hidden');
                }
                console.error("Critical dependencies missing (SafeUI, DOMHelpers, UIPatterns, SharedSettingsModal, BackupRestore).");
                return;
            }

            console.log(`[Calculator] Initializing v${APP_CONFIG.VERSION} via bootstrap:ready`);

            const defaultState = {
                ui: {
                    shiftStart: '08:00',
                    shiftEnd: '16:00',
                    breakTime: 60,
                    currentCallTime: '0',
                    currentTickets: 0,
                    isScheduleCollapsed: true
                }
            };

            const ctx = await AppLifecycle.initPage({
                storageKey: APP_CONFIG.DATA_KEY,
                defaultState: defaultState,
                version: APP_CONFIG.VERSION,
                requiredElements: [
                    'navbar-container', 'toast', 'modal-overlay', 'modal-content',
                    'shiftStart', 'shiftEnd', 'breakTime',
                    'currentCallTime', 'currentTickets', 'addCallTime', 'btnAddCallTime',
                    'currentTime', 'totalProductiveTime', 'totalWorkTimeEOD',
                    'targets-grid',
                    'btnResetData',
                    'calc-info-content',
                    'app-startup-error',
                    'schedule-header', 'schedule-content', 'schedule-collapse-icon'
                ]
            });

            if (!ctx) {
                AppLifecycle._showErrorBanner("Application Failed to Load", "Failed to initialize application context (ctx is null).");
                console.error("Failed to initialize application context (ctx is null).");
                return;
            }

            const { elements: DOMElements, state, saveState } = ctx;

            SharedSettingsModal.init({
                buttonId: 'btnSettings',
                appName: APP_CONFIG.NAME,
                state: state,
                itemValidators: {
                    'ui': ['shiftStart', 'shiftEnd', 'breakTime']
                },
                onRestoreCallback: (restoredData) => {
                    const dataToRestore = restoredData.ui ? restoredData.ui : restoredData;

                    if (dataToRestore.shiftStart && dataToRestore.shiftEnd) {
                        state.ui = dataToRestore;
                        saveState();

                        updateInputsFromState();
                        calculateDailyRatings();
                        renderScheduleCollapse();
                        SafeUI.showToast('Calculator settings restored.');
                        return true;
                    } else {
                        SafeUI.showModal('Restore Error', '<p>The backup file did not contain valid calculator UI data.</p>', [{ label: 'OK' }]);
                        return false;
                    }
                }
            });


            const CONSTANTS = {
                LEEWAY_RATIO: 1 / 7,
                TICKETS_PER_HOUR_RATE: 6,
                ROUNDING_BOUNDARY_MAX: 29,
                PHONE_CLOSE_MINUTES: 15 * 60 + 30, // 15:30
                REACHABLE_TICKET_THRESHOLD: 10
            };

            const gradeBoundaries = {
                'Outstanding': { name: 'Outstanding', min: 7, max: Infinity },
                'Excellent': { name: 'Excellent', min: 4, max: 6 },
                'Satisfactory': { name: 'Satisfactory', min: -3, max: 3 }
            };

            // Use shared DateUtils from app-core.js
            const TimeUtil = {
                ...DateUtils,
                parseShiftTimeToMinutes(timeStr) {
                    const parts = timeStr.split(':').map(Number);
                    return (parts[0] * 60) + parts[1];
                }
            };

            function getCallTimeAlternative(boundary, currentTicketsSoFar, totalProductiveMinutes, currentCallTimeSoFar, productiveMinutesRemaining, ticketsNeeded) {
                const maxAllowableTargetCalc = currentTicketsSoFar - boundary.min;
                const maxRoundedHours = Math.floor(maxAllowableTargetCalc / CONSTANTS.TICKETS_PER_HOUR_RATE);
                const maxWorkTimeMinutes = (maxRoundedHours * 60) + CONSTANTS.ROUNDING_BOUNDARY_MAX;
                const maxCallTimeAllowed = totalProductiveMinutes - maxWorkTimeMinutes;
                const additionalCallMinutes = maxCallTimeAllowed - currentCallTimeSoFar;

                if (additionalCallMinutes > 0) {
                    const flooredMinutes = Math.floor(additionalCallMinutes);
                    const displayTime = TimeUtil.formatMinutesToHHMMShort(flooredMinutes);

                    // Enhancement: Is this easier?
                    // Cost of 1 ticket ~ 10 mins (60/6).
                    const workTimeCost = ticketsNeeded * 10;
                    const isEasier = flooredMinutes < workTimeCost;
                    const easierBadge = isEasier ? ' <span style="background:#28a745; color:white; padding:1px 4px; border-radius:3px; font-size:0.8em;">⚡ EASIER</span>' : '';

                    if (additionalCallMinutes <= productiveMinutesRemaining) {
                        return {
                            additionalCallMinutes: flooredMinutes,
                            callTimeHtml: `<strong>OR</strong> ${displayTime} more calls${easierBadge}`
                        };
                    } else {
                        return {
                            additionalCallMinutes: flooredMinutes,
                            callTimeHtml: `<strong>OR</strong> ${displayTime} (exceeds shift)`
                        };
                    }
                }
                return null;
            }

            function populateTimeOptions(select, startHour, endHour, defaultVal) {
                for (let h = startHour; h <= endHour; h++) {
                    for (let m = 0; m < 60; m += 15) {
                        const hourStr = String(h).padStart(2, '0');
                        const minStr = String(m).padStart(2, '0');
                        const timeStr = `${hourStr}:${minStr}`;
                        const option = document.createElement('option');
                        option.value = timeStr;
                        option.text = timeStr;
                        if (timeStr === defaultVal) option.selected = true;
                        select.appendChild(option);
                    }
                }
            }

            function updateInputsFromState() {
                if (!state.ui) state.ui = { ...defaultState.ui };

                DOMElements.shiftStart.value = state.ui.shiftStart || defaultState.ui.shiftStart;
                DOMElements.shiftEnd.value = state.ui.shiftEnd || defaultState.ui.shiftEnd;
                DOMElements.breakTime.value = isNaN(state.ui.breakTime) ? defaultState.ui.breakTime : state.ui.breakTime;
                DOMElements.currentCallTime.value = state.ui.currentCallTime || '00:00';
                DOMElements.currentTickets.value = isNaN(state.ui.currentTickets) ? 0 : state.ui.currentTickets;
            }

            const debouncedCalculateAndSave = SafeUI.debounce(() => {
                state.ui.shiftStart = DOMElements.shiftStart.value;
                state.ui.shiftEnd = DOMElements.shiftEnd.value;
                state.ui.breakTime = parseInt(DOMElements.breakTime.value, 10) || 0;
                state.ui.currentCallTime = DOMElements.currentCallTime.value;
                state.ui.currentTickets = parseInt(DOMElements.currentTickets.value, 10) || 0;

                saveState();
                calculateDailyRatings();
            }, 250);

            function handleAddCallTime() {
                const currentMinutes = TimeUtil.parseTimeToMinutes(DOMElements.currentCallTime.value);
                const minutesToAdd = parseInt(DOMElements.addCallTime.value, 10) || 0;

                if (minutesToAdd === 0) return;

                const newTotalMinutes = currentMinutes + minutesToAdd;
                DOMElements.currentCallTime.value = TimeUtil.formatMinutesToHHMM(newTotalMinutes);
                DOMElements.addCallTime.value = '';
                debouncedCalculateAndSave();
            }

            function handleResetData() {
                state.ui = JSON.parse(JSON.stringify(defaultState.ui));
                updateInputsFromState();
                renderScheduleCollapse();
                calculateDailyRatings();
                saveState();
                SafeUI.showToast('Data reset to defaults');
            }

            function autoImportBookmarkletData() {
                let minsToImport = 0;
                try {
                    minsToImport = parseInt(localStorage.getItem(APP_CONFIG.IMPORT_KEY) || "0", 10);
                } catch (err) {
                    console.warn("Failed to read from localStorage (sandboxed?):", err.message);
                    return;
                }

                try {
                    if (minsToImport > 0) {
                        const currentMinutes = TimeUtil.parseTimeToMinutes(DOMElements.currentCallTime.value);
                        const newTotalMinutes = currentMinutes + minsToImport;
                        DOMElements.currentCallTime.value = TimeUtil.formatMinutesToHHMM(newTotalMinutes);
                        localStorage.removeItem(APP_CONFIG.IMPORT_KEY);
                        debouncedCalculateAndSave();
                        SafeUI.showToast(`Imported ${minsToImport} minutes from call logger.`);
                    }
                } catch (err) {
                    console.error("Failed to process auto-import data:", err);
                }
            }

            function getScheduleInfo(now) {
                const startTime = new Date(now);
                const startMinutes = TimeUtil.parseShiftTimeToMinutes(DOMElements.shiftStart.value);
                startTime.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

                const endTime = new Date(now);
                const endMinutes = TimeUtil.parseShiftTimeToMinutes(DOMElements.shiftEnd.value);
                endTime.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

                const breakTimeMinutes = parseInt(DOMElements.breakTime.value, 10) || 0;
                const totalShiftMinutes = (endTime - startTime) / 60000;

                if (totalShiftMinutes <= 0) {
                    return {
                        totalProductiveMinutes: 0,
                        productiveMinutesRemaining: 0,
                        error: "Shift end time must be after shift start time."
                    };
                }

                const postBreakMinutes = totalShiftMinutes - breakTimeMinutes;
                const leewayTimeMinutes = postBreakMinutes * CONSTANTS.LEEWAY_RATIO;
                const totalProductiveMinutes = postBreakMinutes - leewayTimeMinutes;

                let workdayMinutesPassed = (now - startTime) / 60000;
                if (workdayMinutesPassed < 0) workdayMinutesPassed = 0;
                if (workdayMinutesPassed > totalShiftMinutes) workdayMinutesPassed = totalShiftMinutes;

                let productiveMinutesPassed = 0;
                if (totalShiftMinutes > 0) {
                    productiveMinutesPassed = (workdayMinutesPassed / totalShiftMinutes) * totalProductiveMinutes;
                }

                const productiveMinutesPassedSafe = Math.min(productiveMinutesPassed, totalProductiveMinutes);
                const productiveMinutesRemaining = totalProductiveMinutes - productiveMinutesPassedSafe;

                return {
                    totalProductiveMinutes,
                    productiveMinutesRemaining,
                    productiveMinutesPassed: productiveMinutesPassedSafe,
                    error: null,
                    totalShiftMinutes
                };
            }

            // --- Updated Logic: Dynamic Phone Close ---
            function getEffectivePhoneCloseMinutes() {
                const shiftEndMinutes = TimeUtil.parseShiftTimeToMinutes(DOMElements.shiftEnd.value);
                // Phones close at 15:30 OR Shift End, whichever is earlier.
                return Math.min(shiftEndMinutes, CONSTANTS.PHONE_CLOSE_MINUTES);
            }

            // --- Updated Logic: Dynamic Phone Close ---
            function getEffectivePhoneCloseMinutes() {
                const shiftEndMinutes = TimeUtil.parseShiftTimeToMinutes(DOMElements.shiftEnd.value);
                // Phones close at 15:30 OR Shift End, whichever is earlier.
                return Math.min(shiftEndMinutes, CONSTANTS.PHONE_CLOSE_MINUTES);
            }

            function updateTimeDisplays(now) {
                DOMElements.currentTime.innerText = now.toLocaleTimeString();
            }

            function buildTargetCardHTML(label, value, description) {
                return `
                    <div style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:center;">
                        <span class="target-label">${label}</span>
                        <span class="target-value">${value}</span>
                        <span class="target-desc">${description}</span>
                    </div>
                `;
            }

            function getTargetCardState({ boundary, totalWorkTimeEOD, ticketsNeeded, ticketsToHitGrade, productiveMinutesRemaining, callTimeHtml }) {
                if (ticketsNeeded <= 0) {
                    return {
                        boxClass: 'target-good',
                        html: buildTargetCardHTML(boundary.name, "✓", `Goal: ${ticketsToHitGrade}`)
                    };
                }
                // Concatenate Goal info and Call Time Alternative if present
                let desc = `Goal: ${ticketsToHitGrade}`;

                // UX Feature: "Total minutes for the goal"
                if (ticketsNeeded > 0) {
                    const minutesForGoal = ticketsNeeded * 10;
                    desc += ` (${TimeUtil.formatMinutesToHHMMShort(minutesForGoal)})`;
                }

                if (callTimeHtml) {
                    // callTimeHtml already contains "OR X more calls"
                    desc += `<br>${callTimeHtml}`;
                }

                if (productiveMinutesRemaining <= 0 && ticketsNeeded > 0) {
                    return {
                        boxClass: 'target-danger',
                        html: buildTargetCardHTML(boundary.name, ticketsNeeded, desc)
                    };
                }
                return {
                    boxClass: 'target-warn',
                    html: buildTargetCardHTML(boundary.name, ticketsNeeded, desc)
                };
            }

            function calculateGradeRequirements(baseTarget) {
                return {
                    'Satisfactory': baseTarget + gradeBoundaries.Satisfactory.min,
                    'Excellent': baseTarget + gradeBoundaries.Excellent.min,
                    'Outstanding': baseTarget + gradeBoundaries.Outstanding.min
                };
            }

            function buildGradeStatusRow(gradeName, targetAmount, currentTickets, isPacing = false) {
                const ticketsNeeded = Math.max(0, targetAmount - currentTickets);
                const achieved = ticketsNeeded === 0;

                let icon, rowClass, message;

                if (isPacing) {
                    const reachable = ticketsNeeded <= CONSTANTS.REACHABLE_TICKET_THRESHOLD;
                    if (achieved) {
                        icon = '✓';
                        rowClass = 'pacing-good';
                        message = 'On track';
                    } else if (reachable) {
                        icon = '⚠️';
                        rowClass = 'pacing-warn';
                        message = `Need ${ticketsNeeded} more by 3:30 PM`;
                    } else {
                        icon = '❌';
                        rowClass = 'pacing-fail';
                        message = `Need ${ticketsNeeded} more (challenging)`;
                    }
                } else {
                    if (achieved) {
                        icon = '✓';
                        rowClass = 'pacing-good';
                        const ticketsOver = currentTickets - targetAmount;
                        message = ticketsOver > 0 ? `Achieved (+${ticketsOver} extra)` : 'Achieved';
                    } else {
                        icon = '⚠️';
                        rowClass = 'pacing-fail';
                        message = `${ticketsNeeded} short`;
                    }
                }

                return `
                    <div class="pacing-row ${rowClass}">
                        <div>
                            <strong>${icon} ${gradeName}</strong>
                            <span class="pacing-details">(${targetAmount} tickets)</span>
                        </div>
                        <div class="pacing-message">
                            ${message}
                        </div>
                    </div>
                `;
            }


            function renderCalculationInfo(scheduleData, now) {
                const {
                    totalWorkTimeEOD,
                    currentTicketsSoFar,
                    productiveMinutesRemaining,
                    roundedWorkHours,
                    targetTicketGoal,
                    totalProductiveMinutes,
                    currentCallTimeSoFar,
                    productiveMinutesPassed, // Used for strategy advice
                    totalShiftMinutes // passed from calculateDailyRatings->getScheduleInfo
                } = scheduleData;

                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();
                const currentTimeMinutes = currentHour * 60 + currentMinute;

                const effectivePhoneCloseMinutes = getEffectivePhoneCloseMinutes();
                const phonesStillOpen = currentTimeMinutes < effectivePhoneCloseMinutes;

                const currentGrades = calculateGradeRequirements(targetTicketGoal);

                const shiftStartMinutes = TimeUtil.parseShiftTimeToMinutes(DOMElements.shiftStart.value);
                const minutesIntoShift = currentTimeMinutes - shiftStartMinutes;

                if (phonesStillOpen && minutesIntoShift <= 0) {
                    DOMElements.calcInfoContent.innerHTML = `
                        <div class="info-box">
                            <strong>⏰ Shift Has Not Started</strong>
                            <p style="margin: 8px 0 0 0;">Pacing analysis will begin at ${DOMElements.shiftStart.value}.</p>
                        </div>
                    `;
                    return;
                }

                // Gather Strategies (Common for both states)
                const strategies = getStrategicAdvice(currentTicketsSoFar, productiveMinutesPassed, totalWorkTimeEOD, phonesStillOpen ? minutesUntilPhoneClose : 0, phonesStillOpen, totalProductiveMinutes);

                // Add Rounding Optimization to strategies if applicable
                const optimization = detectRoundingOptimization(totalWorkTimeEOD);
                if (optimization) {
                    if (optimization.type === 'reactive') {
                        const displayMinutes = Math.ceil(optimization.minutes);
                        strategies.push({
                             type: 'warn',
                             title: 'Target Optimization',
                             text: `Add <strong>${displayMinutes} min</strong> Call Time to reach the next rounding tier (lowers target by 6).`
                        });
                    } else if (optimization.type === 'preventative') {
                         strategies.push({
                             type: 'warn',
                             title: 'Target Optimization',
                             text: `Approaching rounding zone. Stop working tickets soon to keep the lower target.`
                        });
                    }
                }

                let statusHtml = `<div class="info-box">`;

                if (phonesStillOpen) {
                    const callRatePerHour = (minutesIntoShift > 0) ? (currentCallTimeSoFar / minutesIntoShift) * 60 : 0;
                    const minutesUntilPhoneClose = effectivePhoneCloseMinutes - currentTimeMinutes;

                    const projectedCallsByPhoneClose = currentCallTimeSoFar + (callRatePerHour * (minutesUntilPhoneClose / 60));
                    const projectedFinalWorkTime = totalProductiveMinutes - projectedCallsByPhoneClose;
                    const projectedRoundedHours = Math.round(projectedFinalWorkTime / 60);
                    const projectedTarget = projectedRoundedHours * CONSTANTS.TICKETS_PER_HOUR_RATE;
                    const projectedGrades = calculateGradeRequirements(projectedTarget);
                    const phoneCloseTimeStr = TimeUtil.formatMinutesToHHMM(effectivePhoneCloseMinutes);

                    let statusHtml = `
                        <div class="info-box">
                            <div style="padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--border-color);">
                                <strong>${TimeUtil.formatTimeAMPM(currentHour, currentMinute)}</strong> |
                                ${currentTicketsSoFar} tickets |
                                ${TimeUtil.formatMinutesToHHMM(currentCallTimeSoFar)} calls
                            </div>

                            <div style="font-size: 0.9em;">
                                <strong>Projection by ${phoneCloseTimeStr}:</strong>
                                <br>
                                Calls: ~${TimeUtil.formatMinutesToHHMM(projectedCallsByPhoneClose)}
                                <span style="opacity: 0.7;">(${Math.floor(callRatePerHour)} min/hr)</span>
                                <br>
                                Work time: ~${TimeUtil.formatMinutesToHHMM(projectedFinalWorkTime)} → ${projectedRoundedHours} hrs
                                <br>
                                Target: <strong>${projectedTarget}</strong> tickets
                            </div>

                            <div style="margin-top: 8px;">
                    `;

                    // Ticket Projection Logic
                    const ticketRatePerMinute = (minutesIntoShift > 0) ? currentTicketsSoFar / minutesIntoShift : 0;
                    const projectedAdditionalTickets = ticketRatePerMinute * minutesUntilPhoneClose;
                    const projectedTotalTickets = Math.floor(currentTicketsSoFar + projectedAdditionalTickets);

                    // Determine Projected Grade
                    let projectedGradeName = 'Below Expectations';
                    let projectedGradeClass = 'pacing-fail';

                    if (projectedTotalTickets >= projectedTarget + gradeBoundaries.Outstanding.min) {
                        projectedGradeName = 'Outstanding';
                        projectedGradeClass = 'pacing-good';
                    } else if (projectedTotalTickets >= projectedTarget + gradeBoundaries.Excellent.min) {
                         projectedGradeName = 'Excellent';
                         projectedGradeClass = 'pacing-good';
                    } else if (projectedTotalTickets >= projectedTarget + gradeBoundaries.Satisfactory.min) {
                         projectedGradeName = 'Satisfactory';
                         projectedGradeClass = 'pacing-warn';
                    }

                    statusHtml += `
                        <div class="stat-box-highlight" style="text-align:left; display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px;">
                            <div>
                                <div style="font-size:0.7rem; color:var(--subtle-text); text-transform:uppercase;">Forecast</div>
                                <div style="font-size:1.1rem; font-weight:bold;">~${projectedTotalTickets} <span style="font-size:0.8rem; font-weight:normal;">Tickets</span></div>
                                <div class="${projectedGradeClass}" style="font-weight:600; font-size:0.85rem;">${projectedGradeName}</div>
                            </div>
                            <div style="border-left:1px solid var(--border-color); padding-left:8px;">
                                <div style="font-size:0.7rem; color:var(--subtle-text); text-transform:uppercase;">Projected Goal</div>
                                <div style="font-size:1.1rem; font-weight:bold;">${projectedTarget} <span style="font-size:0.8rem; font-weight:normal;">Tickets</span></div>
                                <div style="font-size:0.75rem; opacity:0.8;">via ${projectedRoundedHours}h Work</div>
                            </div>
                        </div>
                    `;

                    // Ticket Projection Logic
                    const ticketRatePerMinute = (minutesIntoShift > 0) ? currentTicketsSoFar / minutesIntoShift : 0;
                    const projectedAdditionalTickets = ticketRatePerMinute * minutesUntilPhoneClose;
                    const projectedTotalTickets = Math.floor(currentTicketsSoFar + projectedAdditionalTickets);

                    // Determine Projected Grade
                    let projectedGradeName = 'Below Expectations';
                    let projectedGradeClass = 'pacing-fail';

                    if (projectedTotalTickets >= projectedTarget + gradeBoundaries.Outstanding.min) {
                        projectedGradeName = 'Outstanding';
                        projectedGradeClass = 'pacing-good';
                    } else if (projectedTotalTickets >= projectedTarget + gradeBoundaries.Excellent.min) {
                         projectedGradeName = 'Excellent';
                         projectedGradeClass = 'pacing-good';
                    } else if (projectedTotalTickets >= projectedTarget + gradeBoundaries.Satisfactory.min) {
                         projectedGradeName = 'Satisfactory';
                         projectedGradeClass = 'pacing-warn';
                    }

                    statusHtml += `
                        <div class="stat-box-highlight" style="text-align:left; display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px;">
                            <div>
                                <div style="font-size:0.7rem; color:var(--subtle-text); text-transform:uppercase;">Forecast</div>
                                <div style="font-size:1.1rem; font-weight:bold;">~${projectedTotalTickets} <span style="font-size:0.8rem; font-weight:normal;">Tickets</span></div>
                                <div class="${projectedGradeClass}" style="font-weight:600; font-size:0.85rem;">${projectedGradeName}</div>
                            </div>
                            <div style="border-left:1px solid var(--border-color); padding-left:8px;">
                                <div style="font-size:0.7rem; color:var(--subtle-text); text-transform:uppercase;">Projected Goal</div>
                                <div style="font-size:1.1rem; font-weight:bold;">${projectedTarget} <span style="font-size:0.8rem; font-weight:normal;">Tickets</span></div>
                                <div style="font-size:0.75rem; opacity:0.8;">via ${projectedRoundedHours}h Work</div>
                            </div>
                        </div>

                        <div style="font-size: 0.8rem; opacity: 0.8; margin-bottom: 8px;">
                            Projection based on current pace (${Math.floor(callRatePerHour)} min calls/hr).
                            <br>
                            <strong>Info:</strong> 10 mins Call Time ≈ -1 Ticket Target.
                        </div>
                    `;

                } else {
                    // Phones Closed - Just show summary, no repetitive grade list
                    statusHtml += `
                        <strong>📞 Phones Closed</strong>
                        <p style="margin: 8px 0 0 0;">
                            Final work time: <strong>${TimeUtil.formatMinutesToHHMM(totalWorkTimeEOD)}</strong>
                            → ${roundedWorkHours} hrs → Target: ${targetTicketGoal}
                        </p>
                    `;
                }

                // Append Strategies
                if (strategies.length > 0) {
                    statusHtml += `<div class="strategy-container">`;
                    strategies.forEach(strat => {
                        let stratClass = 'strategy-success';
                        if (strat.type === 'danger') stratClass = 'strategy-danger';
                        if (strat.type === 'warn') stratClass = 'strategy-warn';

                        statusHtml += `
                            <div class="strategy-card ${stratClass}">
                                <div class="strategy-title">${strat.title}</div>
                                <div class="strategy-text">${strat.text}</div>
                            </div>
                        `;
                    });
                    statusHtml += `</div>`;
                }

                statusHtml += `</div>`; // Close info-box
                DOMElements.calcInfoContent.innerHTML = statusHtml;
            }

            function renderErrorState(errorMessage, errorData) {
                DOMElements.totalWorkTimeEOD.innerText = '00:00';
                DOMElements.targetsGrid.innerHTML = `<div class="info-box info-box-danger" style="grid-column: 1 / -1;">${errorMessage}</div>`;
                renderCalculationInfo(errorData, new Date());
            }

            function detectRoundingOptimization(workTimeMinutes) {
                const minutesInHour = workTimeMinutes % 60;

                // Reactive: In Round Up zone (30-59). Suggest Call Time to reach :29.
                if (minutesInHour >= 30) {
                    const reductionNeeded = minutesInHour - 29;
                    if (reductionNeeded <= 30) { // Allow up to 30 mins advice
                        return { type: 'reactive', minutes: reductionNeeded };
                    }
                }

                // Preventative: Approaching rounding zone (25-29).
                if (minutesInHour >= 25 && minutesInHour <= 29) {
                     return { type: 'preventative', minutes: 0 };
                }

                return null;
            }

            // --- STRATEGIC ADVICE LOGIC ---
            function getStrategicAdvice(currentTickets, elapsedProductiveMinutes, totalEODWorkMinutes, minutesUntilPhoneClose, phonesStillOpen, totalProductiveMinutes) {
                const strategies = [];
                const currentRoundedHours = Math.round(totalEODWorkMinutes / 60);
                const currentTarget = currentRoundedHours * CONSTANTS.TICKETS_PER_HOUR_RATE;

                // 1. "Efficiency Threshold Alert" (Rate Check)
                // Trigger after 50% of shift elapsed (productive time)
                if (elapsedProductiveMinutes > (totalProductiveMinutes / 2)) {
                    // Prevent division by zero
                    const safeElapsed = elapsedProductiveMinutes || 1;
                    const ticketsPerHour = (currentTickets / safeElapsed) * 60;

                    if (ticketsPerHour < 5.0) {
                        strategies.push({
                            type: 'danger',
                            title: 'Efficiency Threshold Alert',
                            text: `Current rate (${ticketsPerHour.toFixed(1)} t/hr) is below efficiency threshold. Switch to Call Time to freeze target debt.`
                        });
                    }
                }

                // 2. "End Game Sprint" (45 min warning)
                if (phonesStillOpen && minutesUntilPhoneClose <= 45 && minutesUntilPhoneClose > 0) {
                    // Look for nearest reachable grade
                    const grades = [
                        { name: 'Outstanding', offset: 7 },
                        { name: 'Excellent', offset: 4 },
                        { name: 'Satisfactory', offset: -3 }
                    ];

                    let sprintSuggested = false;

                    for (const grade of grades) {
                        const needed = (currentTarget + grade.offset) - currentTickets;

                        // Scenario A: SPRINT (Close enough to reach)
                        if (needed > 0 && needed <= 5) {
                            strategies.push({
                                type: 'success',
                                title: 'End Game Sprint',
                                text: `Sprint to reach ${grade.name} in ${Math.ceil(minutesUntilPhoneClose)} min. Need ${needed} more tickets.`
                            });
                            sprintSuggested = true;
                            break;
                        }

                        // Scenario B: SATISFACTORY MISS (Impossible to fail safe)
                        if (grade.name === 'Satisfactory' && needed > 0) {
                             // Assuming ~8-10 mins per ticket needed
                             const maxPossible = Math.floor(minutesUntilPhoneClose / 8);
                             if (needed > maxPossible) {
                                strategies.push({
                                    type: 'warn',
                                    title: 'Resource Conservation',
                                    text: `Satisfactory is unlikely. Save tickets for tomorrow.`
                                });
                                sprintSuggested = true;
                             }
                        }
                    }

                    // Scenario C: OVERSHOOT (Resource Conservation)
                    if (!sprintSuggested) {
                        for (const grade of grades) {
                             const needed = (currentTarget + grade.offset) - currentTickets;
                             if (needed > 5) continue; // Too far

                             // If we have achieved this grade (needed <= 0), and the higher grade was too far (continue loop above).
                             if (needed <= 0) {
                                 strategies.push({
                                    type: 'warn',
                                    title: 'Resource Conservation',
                                    text: `Grade secured. Save extra tickets for tomorrow.`
                                 });
                                 break;
                             }
                        }
                    }
                }

                // 3. "Grade Lock" (Reverse Engineering)
                // Look for opportunities where adding <= 30 mins Call Time lowers target to hit a higher grade.
                const grades = [
                    { name: 'Outstanding', offset: 7 },
                    { name: 'Excellent', offset: 4 },
                    { name: 'Satisfactory', offset: -3 }
                ];

                for (const grade of grades) {
                    const currentRequirement = currentTarget + grade.offset;
                    if (currentTickets >= currentRequirement) continue; // Already have it

                    // Calculate max work hours allowed to have a target that we satisfy with currentTickets
                    // tickets = hours * 6 + offset
                    // hours = (tickets - offset) / 6
                    const maxH = Math.floor((currentTickets - grade.offset) / CONSTANTS.TICKETS_PER_HOUR_RATE);

                    // We need work hours to be maxH.
                    // To get maxH, work minutes must be <= (maxH * 60) + 29
                    const maxWorkMinutes = (maxH * 60) + CONSTANTS.ROUNDING_BOUNDARY_MAX;
                    const reductionNeeded = totalEODWorkMinutes - maxWorkMinutes;

                    // Feasibility: positive reduction, max 30 mins
                    if (reductionNeeded > 0 && reductionNeeded <= 30) {
                        strategies.push({
                            type: 'success',
                            title: `Grade Lock: ${grade.name}`,
                            text: `Add <strong>${Math.ceil(reductionNeeded)} min</strong> of Admin Time to lock in ${grade.name}.`
                        });
                        break;
                    }
                }

                return strategies;
            }

            function calculateDailyRatings() {
                const now = (window.APP_TIME_TRAVEL_DATE) ? new Date(window.APP_TIME_TRAVEL_DATE) : new Date();

                const { totalProductiveMinutes, productiveMinutesRemaining, productiveMinutesPassed, error: scheduleError, totalShiftMinutes } = getScheduleInfo(now);

                DOMElements.totalProductiveTime.innerText = TimeUtil.formatMinutesToHHMM(totalProductiveMinutes);

                const errorData = {
                    totalWorkTimeEOD: -1,
                    currentTicketsSoFar: 0,
                    productiveMinutesRemaining: 0,
                    roundedWorkHours: 0,
                    targetTicketGoal: 0,
                    totalProductiveMinutes: 0,
                    currentCallTimeSoFar: 0,
                    productiveMinutesPassed: 0
                };

                if (scheduleError) {
                    renderErrorState(scheduleError, errorData);
                    return;
                }
                if (totalProductiveMinutes <= 0) {
                    renderErrorState("Invalid Schedule: Productive time must be greater than 0. Check shift or break times.", errorData);
                    return;
                }

                const currentCallTimeSoFar = TimeUtil.parseTimeToMinutes(DOMElements.currentCallTime.value);
                const currentTicketsSoFar = parseInt(DOMElements.currentTickets.value) || 0;

                const totalWorkTimeEOD = totalProductiveMinutes - currentCallTimeSoFar;

                DOMElements.totalWorkTimeEOD.innerText = TimeUtil.formatMinutesToHHMM_Signed(totalWorkTimeEOD);

                const roundedWorkHours = Math.round(totalWorkTimeEOD / 60);
                const targetTicketGoal = roundedWorkHours * CONSTANTS.TICKETS_PER_HOUR_RATE;

                // UX Improvement: Show Base Target
                if (document.getElementById('baseTargetDisplay')) {
                    document.getElementById('baseTargetDisplay').innerText = targetTicketGoal;
                }

                DOMElements.targetsGrid.innerHTML = '';

                for (const [targetName, boundary] of Object.entries(gradeBoundaries)) {
                    const targetBox = document.createElement('div');
                    targetBox.id = `target${targetName}`;

                    const ticketsToHitGrade = targetTicketGoal + boundary.min;
                    const ticketsNeeded = ticketsToHitGrade - currentTicketsSoFar;

                    let callTimeHtml = '';
                    if (ticketsNeeded > 0 && totalWorkTimeEOD >= 0) {
                        const callAlternative = getCallTimeAlternative(
                            boundary,
                            currentTicketsSoFar,
                            totalProductiveMinutes,
                            currentCallTimeSoFar,
                            productiveMinutesRemaining,
                            ticketsNeeded
                        );
                        if (callAlternative) {
                            callTimeHtml = callAlternative.callTimeHtml;
                        }
                    }

                    const { boxClass, html } = getTargetCardState({
                        boundary,
                        totalWorkTimeEOD,
                        ticketsNeeded,
                        ticketsToHitGrade,
                        productiveMinutesRemaining,
                        callTimeHtml
                    });

                    targetBox.className = `target-card ${boxClass}`;
                    targetBox.innerHTML = html;
                    DOMElements.targetsGrid.appendChild(targetBox);
                }

                renderCalculationInfo({
                    totalWorkTimeEOD,
                    currentTicketsSoFar,
                    productiveMinutesRemaining,
                    roundedWorkHours,
                    targetTicketGoal,
                    totalProductiveMinutes,
                    currentCallTimeSoFar,
                    productiveMinutesPassed, // Pass this for strategy advice
                    totalShiftMinutes
                }, now);
            }

            function renderScheduleCollapse() {
                const isCollapsed = state.ui.isScheduleCollapsed;

                const accordionContainer = DOMElements.scheduleContent.parentElement;
                if (isCollapsed) {
                        accordionContainer.classList.remove('expanded');
                } else {
                        accordionContainer.classList.add('expanded');
                }
            }

            populateTimeOptions(DOMElements.shiftStart, 6, 12, state.ui?.shiftStart || defaultState.ui.shiftStart);
            populateTimeOptions(DOMElements.shiftEnd, 12, 18, state.ui?.shiftEnd || defaultState.ui.shiftEnd);

            updateInputsFromState();

            DOMElements.scheduleHeader.addEventListener('click', () => {
                state.ui.isScheduleCollapsed = !state.ui.isScheduleCollapsed;
                renderScheduleCollapse();
                saveState();
            });

            DOMElements.shiftStart.addEventListener('input', debouncedCalculateAndSave);
            DOMElements.shiftEnd.addEventListener('input', debouncedCalculateAndSave);
            DOMElements.breakTime.addEventListener('input', debouncedCalculateAndSave);
            DOMElements.currentCallTime.addEventListener('input', debouncedCalculateAndSave);
            DOMElements.currentTickets.addEventListener('input', debouncedCalculateAndSave);
            DOMElements.btnAddCallTime.addEventListener('click', handleAddCallTime);

            DOMElements.currentCallTime.addEventListener('blur', () => {
                const currentMinutes = TimeUtil.parseTimeToMinutes(DOMElements.currentCallTime.value);
                DOMElements.currentCallTime.value = TimeUtil.formatMinutesToHHMM(currentMinutes);
            });

            DOMElements.btnResetData.addEventListener('click', () => {
                SafeUI.showModal(
                    'Reset Data',
                    '<p>Are you sure you want to reset all data to defaults? This cannot be undone.</p>',
                    [
                        { label: 'Cancel' },
                        { label: 'Reset', class: 'button-danger', callback: handleResetData }
                    ]
                );
            });

            DOMElements.addCallTime.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleAddCallTime();
            });

            function handleTimerTick() {
                const now = new Date();
                updateTimeDisplays(now);

                if (document.visibilityState === 'visible') {
                    const seconds = now.getSeconds();
                    if (seconds === 0 || seconds === 30) {
                        calculateDailyRatings();
                    }
                }
            }

            setInterval(handleTimerTick, 1000);

            renderScheduleCollapse();
            calculateDailyRatings();

            const initialCallMinutes = TimeUtil.parseTimeToMinutes(DOMElements.currentCallTime.value);
            DOMElements.currentCallTime.value = TimeUtil.formatMinutesToHHMM(initialCallMinutes);

            autoImportBookmarkletData();

            if (Object.keys(state.ui || {}).length > 0) {
                SafeUI.showToast('Restored previous session');
            }

        } catch (err) {
            console.error("Unhandled exception during initialization:", err);
            const banner = document.getElementById('app-startup-error');
            if (banner) {
                banner.innerHTML = `<strong>Application Error</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">Unexpected error: ${err.message}</p>`;
                banner.classList.remove('hidden');
            }
        }
    })();
}
