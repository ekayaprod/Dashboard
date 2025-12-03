// ============================================================================
// PAGE-SPECIFIC LOGIC: Calculator (calculator.html)
// ============================================================================

AppLifecycle.onBootstrap(initializePage);

function initializePage() {
    const APP_CONFIG = {
        NAME: 'calculator',
        VERSION: '2.2.0', // Major UX Refactor: Unified Strategy
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

            // --- Simplified Card Building Logic (Clean Grid) ---
            function buildTargetCardHTML(label, value, description) {
                return `
                    <div style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; gap: 2px;">
                        <span class="target-label">${label}</span>
                        <span class="target-value">${value}</span>
                        <span class="target-desc">${description}</span>
                    </div>
                `;
            }

            function getTargetCardState({ boundary, ticketsNeeded, ticketsToHitGrade, productiveMinutesRemaining }) {
                if (ticketsNeeded <= 0) {
                    return {
                        boxClass: 'target-good',
                        html: buildTargetCardHTML(boundary.name, "✓", `Goal: ${ticketsToHitGrade}`)
                    };
                }

                // Calculate Work Time needed (Estimate)
                const workMinutesNeeded = ticketsNeeded * 10; 
                const workTimeStr = TimeUtil.formatMinutesToHHMMShort(workMinutesNeeded);
                const desc = `Est. Work: ${workTimeStr}`;

                let boxClass = 'target-warn';
                if (productiveMinutesRemaining <= 0 && ticketsNeeded > 0) {
                    boxClass = 'target-danger';
                }

                return {
                    boxClass: boxClass,
                    html: buildTargetCardHTML(boundary.name, ticketsNeeded, desc)
                };
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

            function updateTimeDisplays(now) {
                DOMElements.currentTime.innerText = now.toLocaleTimeString();
            }

            function calculateGradeRequirements(baseTarget) {
                return {
                    'Satisfactory': baseTarget + gradeBoundaries.Satisfactory.min,
                    'Excellent': baseTarget + gradeBoundaries.Excellent.min,
                    'Outstanding': baseTarget + gradeBoundaries.Outstanding.min
                };
            }

            // NEW: Detailed Rounding Analysis Helper
            function analyzeRoundingPosition(workTimeMinutes) {
                const minutesInHour = workTimeMinutes % 60;
                // Rounding boundary is 30.
                // 0-29: Rounded Down. Target = H * 6.
                // 30-59: Rounded Up. Target = (H+1) * 6.

                if (minutesInHour >= 30) {
                    // Currently Rounded Up.
                    // Distance to drop target (reach 29):
                    const minsToDrop = minutesInHour - 29;
                    return {
                        status: 'high', // Target is inflated by rounding up
                        minsToDropTier: minsToDrop,
                        ticketsToSave: CONSTANTS.TICKETS_PER_HOUR_RATE
                    };
                } else {
                    // Currently Rounded Down.
                    // Distance to increase target (reach 30):
                    const minsToIncrease = 30 - minutesInHour;
                    return {
                        status: 'low', // Target is optimal
                        minsToIncreaseTier: minsToIncrease
                    };
                }
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
                    productiveMinutesPassed, 
                    totalShiftMinutes 
                } = scheduleData;

                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();
                const currentTimeMinutes = currentHour * 60 + currentMinute;

                const effectivePhoneCloseMinutes = getEffectivePhoneCloseMinutes();
                const phonesStillOpen = currentTimeMinutes < effectivePhoneCloseMinutes;
                
                // Calculate essential variables first
                const minutesUntilPhoneClose = effectivePhoneCloseMinutes - currentTimeMinutes;
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

                // --- 1. BUILD UNIFIED INSIGHTS LIST ---
                const insights = [];

                // Insight A: Forecast (Phones Open Only)
                if (phonesStillOpen) {
                    const callRatePerHour = (minutesIntoShift > 0) ? (currentCallTimeSoFar / minutesIntoShift) * 60 : 0;
                    const ticketRatePerMinute = (minutesIntoShift > 0) ? currentTicketsSoFar / minutesIntoShift : 0;
                    
                    const projectedAdditionalTickets = ticketRatePerMinute * minutesUntilPhoneClose;
                    const projectedTotalTickets = Math.floor(currentTicketsSoFar + projectedAdditionalTickets);

                    const projectedCallsByPhoneClose = currentCallTimeSoFar + (callRatePerHour * (minutesUntilPhoneClose / 60));
                    const projectedFinalWorkTime = totalProductiveMinutes - projectedCallsByPhoneClose;
                    const projectedRoundedHours = Math.round(projectedFinalWorkTime / 60);
                    const projectedTarget = projectedRoundedHours * CONSTANTS.TICKETS_PER_HOUR_RATE;
                    
                    // Determine Forecast Grade
                    let forecastGrade = 'Below Exp.';
                    if (projectedTotalTickets >= projectedTarget + gradeBoundaries.Outstanding.min) forecastGrade = 'Outstanding';
                    else if (projectedTotalTickets >= projectedTarget + gradeBoundaries.Excellent.min) forecastGrade = 'Excellent';
                    else if (projectedTotalTickets >= projectedTarget + gradeBoundaries.Satisfactory.min) forecastGrade = 'Satisfactory';

                    insights.push({
                        type: 'forecast',
                        title: 'FORECAST',
                        mainText: `${projectedTotalTickets} Tickets`,
                        subText: `Pacing for ${forecastGrade}`
                    });
                } else {
                     insights.push({
                        type: 'forecast',
                        title: 'STATUS',
                        mainText: 'Phones Closed',
                        subText: `Final Goal: ${targetTicketGoal}`
                    });
                }

                // Insight B: Time to Next Grade
                const gradeList = [
                    { name: 'Satisfactory', offset: gradeBoundaries.Satisfactory.min }, // -3
                    { name: 'Excellent', offset: gradeBoundaries.Excellent.min },       // +4
                    { name: 'Outstanding', offset: gradeBoundaries.Outstanding.min }    // +7
                ].sort((a,b) => a.offset - b.offset);

                let nextGrade = null;
                let ticketsToNext = 0;
                for (const g of gradeList) {
                    const ticketsForGrade = targetTicketGoal + g.offset;
                    const needed = ticketsForGrade - currentTicketsSoFar;
                    if (needed > 0) {
                        nextGrade = g;
                        ticketsToNext = needed;
                        break;
                    }
                }

                if (nextGrade) {
                    const minsForGoal = ticketsToNext * (60 / CONSTANTS.TICKETS_PER_HOUR_RATE); // 10 mins/ticket
                    insights.push({
                        type: 'action',
                        icon: '🎯',
                        title: `Reach ${nextGrade.name}`,
                        text: `Work <strong>${TimeUtil.formatMinutesToHHMMShort(minsForGoal)}</strong> of tickets (${ticketsToNext} count).`
                    });
                } else {
                    insights.push({
                        type: 'success',
                        icon: '🏆',
                        title: 'All Goals Met',
                        text: 'You have reached the highest tier!'
                    });
                }

                // Insight C: Rounding / Target Reduction
                const roundingAnalysis = analyzeRoundingPosition(totalWorkTimeEOD);
                if (roundingAnalysis.status === 'high') {
                     insights.push({
                        type: 'action',
                        icon: '📉',
                        title: 'Drop Target Tier (-6)',
                        text: `Add <strong>${Math.ceil(roundingAnalysis.minsToDropTier)} min</strong> of Call Time (Admin) to reduce goal.`
                    });
                } else if (phonesStillOpen) {
                     // Only show buffer if phones open
                     insights.push({
                        type: 'info',
                        icon: '🛡️',
                        title: 'Target Buffer',
                        text: `You can work <strong>${roundingAnalysis.minsToIncreaseTier} min</strong> of tickets before target increases.`
                    });
                }

                // Insight D: Efficiency Warnings (Generic)
                // Trigger after 50% of shift elapsed (productive time)
                if (phonesStillOpen && productiveMinutesPassed > (totalProductiveMinutes / 2)) {
                    const safeElapsed = productiveMinutesPassed || 1;
                    const ticketsPerHour = (currentTicketsSoFar / safeElapsed) * 60;

                    if (ticketsPerHour < 5.0) {
                         insights.push({
                            type: 'danger',
                            icon: '⚠️',
                            title: 'Efficiency Alert',
                            text: `Rate (${ticketsPerHour.toFixed(1)} t/hr) is low. Switch to Call Time to freeze target.`
                        });
                    }
                }

                // --- 2. RENDER UNIFIED HTML ---
                let html = `<div class="info-box" style="padding: 0;">`;

                // Header Row (Compact Stats)
                html += `
                    <div style="background:var(--info-bg); padding: 8px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; font-size:0.85rem;">
                         <span><strong>${TimeUtil.formatTimeAMPM(currentHour, currentMinute)}</strong></span>
                         <span>${currentTicketsSoFar} Tickets</span>
                         <span>${TimeUtil.formatMinutesToHHMM(currentCallTimeSoFar)} Calls</span>
                    </div>
                `;

                html += `<div style="padding: 8px;">`;

                // Render Insights List
                html += `<div style="display:flex; flex-direction:column; gap:6px;">`;
                
                insights.forEach(item => {
                    if (item.type === 'forecast') {
                        // Special styling for the main forecast header inside the body
                        html += `
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding-bottom:8px; border-bottom:1px dashed var(--border-color);">
                                <div style="font-size:0.8rem; color:var(--subtle-text); font-weight:600;">${item.title}</div>
                                <div style="text-align:right;">
                                    <div style="font-weight:bold; font-size:1.1rem;">${item.mainText}</div>
                                    <div style="font-size:0.75rem; opacity:0.8;">${item.subText}</div>
                                </div>
                            </div>
                        `;
                    } else {
                        // Standard Strategy Card
                        let borderClass = 'strategy-success'; // default green/action
                        if (item.type === 'danger') borderClass = 'strategy-danger';
                        if (item.type === 'info') borderClass = 'strategy-warn'; // yellow/neutral

                        html += `
                            <div class="strategy-card ${borderClass}" style="margin:0; background:var(--bg-color);">
                                <div class="strategy-title" style="display:flex; align-items:center; gap:6px;">
                                    <span>${item.icon}</span> ${item.title}
                                </div>
                                <div class="strategy-text">${item.text}</div>
                            </div>
                        `;
                    }
                });
                
                html += `</div>`; // End List
                html += `</div>`; // End Padding container
                html += `</div>`; // End Info Box

                DOMElements.calcInfoContent.innerHTML = html;
            }

            function renderErrorState(errorMessage, errorData) {
                DOMElements.totalWorkTimeEOD.innerText = '00:00';
                DOMElements.targetsGrid.innerHTML = `<div class="info-box info-box-danger" style="grid-column: 1 / -1;">${errorMessage}</div>`;
                renderCalculationInfo(errorData, new Date());
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

                // Optimization Tip: Hide the old div if it exists (we use the unified report now)
                if (document.getElementById('targetOptimizationTip')) {
                     document.getElementById('targetOptimizationTip').classList.add('hidden');
                }

                DOMElements.targetsGrid.innerHTML = '';

                for (const [targetName, boundary] of Object.entries(gradeBoundaries)) {
                    const targetBox = document.createElement('div');
                    targetBox.id = `target${targetName}`;

                    const ticketsToHitGrade = targetTicketGoal + boundary.min;
                    const ticketsNeeded = ticketsToHitGrade - currentTicketsSoFar;

                    const { boxClass, html } = getTargetCardState({
                        boundary,
                        ticketsNeeded,
                        ticketsToHitGrade,
                        productiveMinutesRemaining
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
                    productiveMinutesPassed, 
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
