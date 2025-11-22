// ============================================================================
// PAGE-SPECIFIC LOGIC: Calculator (calculator.html)
// ============================================================================

// Wait for bootstrap, but timeout if it fails
let bootstrapReady = false;

document.addEventListener('bootstrap:ready', () => {
    bootstrapReady = true;
    initializePage();
});

// Fallback: If bootstrap doesn't fire within 5 seconds, show error
setTimeout(() => {
    if (!bootstrapReady) {
        console.error('Bootstrap did not complete within 5 seconds');
        const banner = document.getElementById('app-startup-error');
        if (banner) {
            banner.innerHTML = `<strong>Application Startup Timeout</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">The application failed to load within 5 seconds. Check the browser console for errors.</p>`;
            banner.classList.remove('hidden');
        }
    }
}, 5000);


function initializePage() {
    const APP_CONFIG = {
        NAME: 'calculator',
        VERSION: '2.0.6', // Bumped for leeway logic fix
        DATA_KEY: 'eod_targets_state_v1',
        IMPORT_KEY: 'eod_targets_import_minutes'
    };

    // ============================================================================
    // INITIALIZATION ROUTINE
    // ============================================================================
    (async () => {
        try {
            // Critical dependency check
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

            // Initialize via AppLifecycle
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
                    // 'btnSettings' // <-- FIX: Removed this. It's loaded optionally by bootstrap.
                ]
            });

            if (!ctx) {
                AppLifecycle._showErrorBanner("Application Failed to Load", "Failed to initialize application context (ctx is null).");
                console.error("Failed to initialize application context (ctx is null).");
                return;
            }

            const { elements: DOMElements, state, saveState } = ctx;

            // --- Initialize Standard Settings Modal ---
            SharedSettingsModal.init({
                buttonId: 'btnSettings', // This init function will safely handle if 'btnSettings' doesn't exist
                appName: APP_CONFIG.NAME,
                state: state, // Pass the entire state object for backup
                itemValidators: {
                    'ui': ['shiftStart', 'shiftEnd', 'breakTime']
                },
                onRestoreCallback: (restoredData) => {
                    const dataToRestore = restoredData.ui ? restoredData.ui : restoredData;

                    if (dataToRestore.shiftStart && dataToRestore.shiftEnd) {
                        state.ui = dataToRestore; // Overwrite the UI state
                        saveState();

                        updateInputsFromState();
                        calculateDailyRatings();
                        renderScheduleCollapse();
                        SafeUI.showToast('Calculator settings restored.');
                        return true; // Close modal
                    } else {
                        SafeUI.showModal('Restore Error', '<p>The backup file did not contain valid calculator UI data.</p>', [{ label: 'OK' }]);
                        return false; // Keep modal open
                    }
                }
            });


            // --- Constants & Utils ---
            const CONSTANTS = {
                LEEWAY_RATIO: 1 / 7,
                TICKETS_PER_HOUR_RATE: 6,
                ROUNDING_BOUNDARY_MAX: 29, // Rounds up at 30+ minutes
                PHONE_CLOSE_MINUTES: 15 * 60 + 30, // 3:30 PM
                REACHABLE_TICKET_THRESHOLD: 10
            };

            const gradeBoundaries = {
                'Outstanding': { name: 'Outstanding', min: 7, max: Infinity },
                'Excellent': { name: 'Excellent', min: 4, max: 6 },
                'Satisfactory': { name: 'Satisfactory', min: -3, max: 3 }
            };

            const TimeUtil = {
                parseTimeToMinutes(input) {
                    if (!input) return 0;
                    const trimmed = String(input).trim();
                    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
                    if (/^\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed) * 60;
                    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
                        const parts = trimmed.split(':').map(Number);
                        return (parts[0] * 60) + parts[1];
                    }
                    if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
                        const parts = trimmed.split(':').map(Number);
                        return (parts[0] * 60) + parts[1] + (parts[2] / 60);
                    }
                    return 0;
                },

                formatMinutesToHHMM(totalMinutes) {
                    if (isNaN(totalMinutes) || totalMinutes < 0) return '00:00';
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = Math.floor(totalMinutes % 60);
                    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                },

                /**
                 * FIX: New formatter that allows negative time.
                 */
                formatMinutesToHHMM_Signed(totalMinutes) {
                    if (isNaN(totalMinutes)) return '00:00';

                    const sign = totalMinutes < 0 ? '-' : '';
                    const absMinutes = Math.abs(totalMinutes);

                    const hours = Math.floor(absMinutes / 60);
                    const minutes = Math.floor(absMinutes % 60);

                    return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                },

                formatMinutesToHHMMShort(totalMinutes) {
                    if (isNaN(totalMinutes) || totalMinutes < 0) return '0m';
                    if (totalMinutes === 0) return '0m';
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = Math.floor(totalMinutes % 60);
                    let parts = [];
                    if (hours > 0) parts.push(`${hours}h`);
                    if (minutes > 0 || hours === 0) parts.push(`${minutes}m`);
                    return parts.join(' ');
                },

                parseShiftTimeToMinutes(timeStr) {
                    const parts = timeStr.split(':').map(Number);
                    return (parts[0] * 60) + parts[1];
                },

                formatTimeAMPM(hour, minute) {
                    return `${String(hour % 12 || 12)}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
                }
            };

            function getCallTimeAlternative(boundary, currentTicketsSoFar, totalProductiveMinutes, currentCallTimeSoFar, productiveMinutesRemaining) {
                const maxAllowableTargetCalc = currentTicketsSoFar - boundary.min;
                const maxRoundedHours = Math.floor(maxAllowableTargetCalc / CONSTANTS.TICKETS_PER_HOUR_RATE);
                const maxWorkTimeMinutes = (maxRoundedHours * 60) + CONSTANTS.ROUNDING_BOUNDARY_MAX;
                const maxCallTimeAllowed = totalProductiveMinutes - maxWorkTimeMinutes;
                const additionalCallMinutes = maxCallTimeAllowed - currentCallTimeSoFar;

                if (additionalCallMinutes > 0) {
                    const flooredMinutes = Math.floor(additionalCallMinutes);
                    const displayTime = TimeUtil.formatMinutesToHHMMShort(flooredMinutes);
                    if (additionalCallMinutes <= productiveMinutesRemaining) {
                        return {
                            additionalCallMinutes: flooredMinutes,
                            callTimeHtml: `<strong>OR</strong> ${displayTime} more calls`
                        };
                    } else {
                        return {
                            additionalCallMinutes: flooredMinutes,
                            callTimeHtml: `<strong>OR</strong> ${displayTime} (exceeds shift)`
                        };
                    }
                }
                return null; // No positive call time alternative
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

                DOMElements.shiftStart.value = state.ui.shiftStart;
                DOMElements.shiftEnd.value = state.ui.shiftEnd;
                DOMElements.breakTime.value = state.ui.breakTime;
                DOMElements.currentCallTime.value = state.ui.currentCallTime;
                DOMElements.currentTickets.value = state.ui.currentTickets;
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
                renderScheduleCollapse(); // Reset collapse state
                calculateDailyRatings();
                saveState(); // Persist the reset
                SafeUI.showToast('Data reset to defaults');
            }

            function autoImportBookmarkletData() {
                let minsToImport = 0;
                try {
                    // Note: Using localStorage, not part of the standard state backup
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
                if (productiveMinutesPassed > totalProductiveMinutes) productiveMinutesPassed = totalProductiveMinutes;
                const productiveMinutesRemaining = totalProductiveMinutes - productiveMinutesPassed;

                return { totalProductiveMinutes, productiveMinutesRemaining, error: null };
            }

            function updateTimeDisplays(now) {
                DOMElements.currentTime.innerText = now.toLocaleTimeString();
            }

            function buildTargetCardHTML(label, value, description) {
                // Uses standard classes from eod-targets-page styles
                return `
                    <span class="target-label">${label}</span>
                    <span class="target-value">${value}</span>
                    <span class="target-desc">${description}</span>
                `;
            }

            function getTargetCardState({ boundary, totalWorkTimeEOD, ticketsNeeded, ticketsToHitGrade, productiveMinutesRemaining, callTimeHtml }) {
                // FIX: Removed the error block for (totalWorkTimeEOD < 0)
                // It will now calculate normally.

                if (ticketsNeeded <= 0) {
                    return {
                        boxClass: 'target-good',
                        html: buildTargetCardHTML(boundary.name, "GOAL MET!", `Target: ${ticketsToHitGrade} tickets`)
                    };
                }
                if (productiveMinutesRemaining <= 0 && ticketsNeeded > 0) {
                    return {
                        boxClass: 'target-danger',
                        html: buildTargetCardHTML(boundary.name, ticketsNeeded, `Tickets short (Goal: ${ticketsToHitGrade})${callTimeHtml ? '<br>' + callTimeHtml : ''}`)
                    };
                }
                return {
                    boxClass: 'target-warn',
                    html: buildTargetCardHTML(boundary.name, ticketsNeeded, `Tickets remaining (Goal: ${ticketsToHitGrade})${callTimeHtml ? '<br>' + callTimeHtml : ''}`)
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
                } else { // Final status (not pacing)
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
                    currentCallTimeSoFar
                } = scheduleData;

                // FIX: Removed the error block for (totalWorkTimeEOD < 0)
                // It will now calculate normally.

                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();
                const currentTimeMinutes = currentHour * 60 + currentMinute;
                const phonesStillOpen = currentTimeMinutes < CONSTANTS.PHONE_CLOSE_MINUTES;

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

                // BEFORE 3:30 PM - Show Pacing
                if (phonesStillOpen) {
                    // FIX: Ensure minutesIntoShift is not zero to avoid divide by zero
                    const callRatePerHour = (minutesIntoShift > 0) ? (currentCallTimeSoFar / minutesIntoShift) * 60 : 0;
                    const minutesUntilPhoneClose = CONSTANTS.PHONE_CLOSE_MINUTES - currentTimeMinutes;

                    const projectedCallsByPhoneClose = currentCallTimeSoFar + (callRatePerHour * (minutesUntilPhoneClose / 60));
                    const projectedFinalWorkTime = totalProductiveMinutes - projectedCallsByPhoneClose;
                    const projectedRoundedHours = Math.round(projectedFinalWorkTime / 60);
                    const projectedTarget = projectedRoundedHours * CONSTANTS.TICKETS_PER_HOUR_RATE;

                    const projectedGrades = calculateGradeRequirements(projectedTarget);

                    let statusHtml = `
                        <div class="info-box">
                            <div style="padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--border-color);">
                                <strong>${TimeUtil.formatTimeAMPM(currentHour, currentMinute)}</strong> |
                                ${currentTicketsSoFar} tickets |
                                ${TimeUtil.formatMinutesToHHMM(currentCallTimeSoFar)} calls
                            </div>

                            <div style="font-size: 0.9em;">
                                <strong>Projection by 3:30 PM:</strong>
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

                    for (const [gradeName, projectedNeeded] of Object.entries(projectedGrades)) {
                        statusHtml += buildGradeStatusRow(gradeName, projectedNeeded, currentTicketsSoFar, true);
                    }

                    statusHtml += `
                            </div>
                        </div>
                    `;

                    DOMElements.calcInfoContent.innerHTML = statusHtml;

                // AFTER 3:30 PM - Show Final Status
                } else {
                    let statusHtml = `
                        <div class="info-box">
                            <strong>📞 Phones Closed</strong>
                            <p style="margin: 8px 0 0 0;">
                                Final work time: <strong>${TimeUtil.formatMinutesToHHMM(totalWorkTimeEOD)}</strong>
                                → ${roundedWorkHours} hrs → Target: ${targetTicketGoal}
                            </p>

                            <div style="margin-top: 8px;">
                    `;

                    for (const [gradeName, needed] of Object.entries(currentGrades)) {
                        statusHtml += buildGradeStatusRow(gradeName, needed, currentTicketsSoFar, false);
                    }

                    statusHtml += `
                            </div>
                        </div>
                    `;

                    DOMElements.calcInfoContent.innerHTML = statusHtml;
                }
            }

            function renderErrorState(errorMessage, errorData) {
                DOMElements.totalWorkTimeEOD.innerText = '00:00';
                DOMElements.targetsGrid.innerHTML = `<div class="info-box info-box-danger" style="grid-column: 1 / -1;">${errorMessage}</div>`;
                renderCalculationInfo(errorData, new Date()); // Pass 'now'
            }

            function calculateDailyRatings() {
                const now = new Date();

                const { totalProductiveMinutes, productiveMinutesRemaining, error: scheduleError } = getScheduleInfo(now);

                DOMElements.totalProductiveTime.innerText = TimeUtil.formatMinutesToHHMM(totalProductiveMinutes);

                const errorData = {
                    totalWorkTimeEOD: -1,
                    currentTicketsSoFar: 0,
                    productiveMinutesRemaining: 0,
                    roundedWorkHours: 0,
                    targetTicketGoal: 0,
                    totalProductiveMinutes: 0,
                    currentCallTimeSoFar: 0
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

                // FIX: Use the new signed formatter to show negative time
                DOMElements.totalWorkTimeEOD.innerText = TimeUtil.formatMinutesToHHMM_Signed(totalWorkTimeEOD);

                const roundedWorkHours = Math.round(totalWorkTimeEOD / 60);
                const targetTicketGoal = roundedWorkHours * CONSTANTS.TICKETS_PER_HOUR_RATE;

                DOMElements.targetsGrid.innerHTML = '';

                for (const [targetName, boundary] of Object.entries(gradeBoundaries)) {
                    const targetBox = document.createElement('div');
                    targetBox.id = `target${targetName}`;

                    const ticketsToHitGrade = targetTicketGoal + boundary.min;
                    const ticketsNeeded = ticketsToHitGrade - currentTicketsSoFar;

                    let callTimeHtml = '';
                    if (ticketsNeeded > 0 && totalWorkTimeEOD >= 0) { // Only show call time alt if work time is positive
                        const callAlternative = getCallTimeAlternative(
                            boundary,
                            currentTicketsSoFar,
                            totalProductiveMinutes,
                            currentCallTimeSoFar,
                            productiveMinutesRemaining
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
                    currentCallTimeSoFar
                }, now);
            }

            function renderScheduleCollapse() {
                const isCollapsed = state.ui.isScheduleCollapsed;

                // --- FIX: Unified Accordion Logic ---
                // The unified accordion uses 'expanded' class on the parent container, not 'collapsed'
                const accordionContainer = DOMElements.scheduleContent.parentElement;
                if (isCollapsed) {
                        accordionContainer.classList.remove('expanded');
                } else {
                        accordionContainer.classList.add('expanded');
                }
                // DOMElements.scheduleCollapseIcon.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)';
            }

            // --- Execution ---
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
                UIPatterns.confirmDelete('Reset Data?', 'Are you sure you want to reset all data to defaults? This cannot be undone.', handleResetData);
            });

            DOMElements.addCallTime.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleAddCallTime();
            });

            function handleTimerTick() {
                const now = new Date();
                updateTimeDisplays(now); // Update clock every second

                if (document.visibilityState === 'visible') {
                    const seconds = now.getSeconds();
                    if (seconds === 0 || seconds === 30) {
                        calculateDailyRatings();
                    }
                }
            }

            setInterval(handleTimerTick, 1000);

            // Initial setup
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
            // Use the raw banner getter as a fallback
            const banner = document.getElementById('app-startup-error');
            if (banner) {
                banner.innerHTML = `<strong>Application Error</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">Unexpected error: ${err.message}</p>`;
                banner.classList.remove('hidden');
            }
        }
    })();
}
