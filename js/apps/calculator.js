// ============================================================================
// PAGE-SPECIFIC LOGIC: Calculator (calculator.html)
// ============================================================================

AppLifecycle.onBootstrap(initializePage);

function initializePage() {
    const APP_CONFIG = {
        NAME: 'calculator',
        VERSION: '3.4.0', // Doc Update: Stats Bar & Call Time Badges
        DATA_KEY: 'eod_targets_state_v1',
        IMPORT_KEY: 'eod_targets_import_minutes'
    };

    /**
     * ============================================================================
     * ORIGINAL SPREADSHEET FORMULAS (SOURCE OF TRUTH)
     * ============================================================================
     *
     * CONTEXT:
     * - B1: PTO (*half day)
     * - B2: Daily Task (Phones vs On/Off)
     * - B3: Tickets Closed
     * - B5: Total Call Time (Duration)
     * - B7: NEDSS (Extra credit tasks, assumed 0 in this app)
     * - B8: Total Work Time (Calculated)
     *
     * 1. TOTAL WORK TIME (The Base):
     * Formula: =IF(B1="*half day", TIME(3,0,0)-B5, IF(B2="OoO","OoO", TIME(6,0,0)-B5))
     * JS Logic: Calculated dynamically.
     * (Shift Duration - Break) * (6/7) - Call Time.
     * This effectively reverses the implicit 7h->6h leeway seen in the static "TIME(6,0,0)" constant.
     *
     * 2. DAILY WORK RATING (The Target):
     * Formula: =IF(B3+B7 >= HOUR(MROUND(B8,"1:00")) * 6 + 7, "Outstanding", ...)
     *
     * Breakdown:
     * - Metric: B3 + B7 (Tickets + NEDSS)
     * - Base:   HOUR(MROUND(B8, "1:00")) -> Rounds Net Work Time to nearest Hour.
     * - Mult:   * 6 (Standard Phones multiplier).
     * - Graded:
     * - Outstanding:       >= (Base * 6) + 7
     * - Excellent:         >= (Base * 6) + 4
     * - Satisfactory:      >= (Base * 6) - 3
     * - Needs Improvement: >= (Base * 6) - 6
     *
     * ============================================================================
     */

    (async () => {
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
                'toast', 'modal-overlay', 'modal-content',
                'shiftStart', 'shiftEnd', 'breakTime',
                'currentCallTime', 'currentTickets', 'addCallTime', 'btnAddCallTime',
                'totalWorkTimeEOD', 'baseTargetDisplay',
                'targets-grid', 'btnResetData', 'calc-info-content',
                'schedule-header', 'schedule-content', 'schedule-collapse-icon',
                'target-stats-bar'
            ]
        });

        if (!ctx) return;

        const { elements: DOMElements, state, saveState } = ctx;

        // --- CONSTANTS ---
        const CONSTANTS = {
            TICKETS_PER_HOUR_RATE: 6, // Matches "Daily Work Rating" * 6 multiplier
            PHONE_CLOSE_MINUTES: 15 * 60 + 30, // 15:30
            LEEWAY_RATIO: 1 / 7 // Aligns with the 6h base from 7h work time
        };

        const gradeBoundaries = {
            // Matches spreadsheet offsets: Target + 7, + 4, - 3
            'Outstanding': { name: 'Outstanding', min: 7, max: Infinity },
            'Excellent': { name: 'Excellent', min: 4, max: 6 },
            'Satisfactory': { name: 'Satisfactory', min: -3, max: 3 }
        };

        // --- 1. DASHBOARD BADGES ---
        function buildTargetCardHTML(label, valueHtml, subtext) {
            return `
                <div style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; gap: 2px;">
                    <span class="target-label">${label}</span>
                    <span class="target-value" style="line-height:1.1;">${valueHtml}</span>
                    <span class="target-desc" style="font-size:0.75rem; opacity:0.9;">${subtext}</span>
                </div>
            `;
        }

        function getTargetCardState({ boundary, ticketsNeeded, productiveMinutesRemaining }) {
            // Scenario: Goal Met
            if (ticketsNeeded <= 0) {
                return {
                    boxClass: 'target-good',
                    html: buildTargetCardHTML(boundary.name, "✓", "Met")
                };
            }

            // Scenario: Time Up
            if (productiveMinutesRemaining <= 0) {
                 return {
                    boxClass: 'target-danger',
                    html: buildTargetCardHTML(boundary.name, `${ticketsNeeded} Short`, "Time Up")
                };
            }

            // Scenario: In Progress
            // We use 10 mins per ticket simply as an effort estimator (60 mins / 6 tickets)
            // This is also the amount of "Call Time" needed to reduce the target by that many tickets.
            const estMinutes = ticketsNeeded * 10;
            
            return {
                boxClass: 'target-warn',
                html: buildTargetCardHTML(
                    boundary.name, 
                    `${ticketsNeeded} <span style="font-size:0.7em; font-weight:normal;">Tickets</span>`, 
                    `Call Time: ${DateUtils.formatMinutesToHM(estMinutes)}`
                )
            };
        }

        // --- 2. STATS BAR ---
        function renderTargetStats(data) {
            const { totalWorkTimeEOD } = data;
            const minutesInHour = totalWorkTimeEOD % 60;
            // Math.round(29.5) = 30 (Round Up). Math.round(29.49) = 29 (Round Down).
            // So cutoff is 29.5.
            const isRoundedUp = minutesInHour >= 29.5;
            let html = '';

            if (isRoundedUp) {
                // Round Up (Target High) -> Suggest Adding Call Time (Admin) to reduce Work Time.
                // Target: Reach < 29.5.
                // Minutes to add = Current - 29.
                const adminNeeded = Math.ceil(minutesInHour - 29);
                html = `
                    <div style="font-size: 0.9rem; text-align: center; color: var(--text-color); padding: 4px; background: rgba(0,0,0,0.05); border-radius: 4px;">
                        <span style="color: var(--warning-text); font-weight: bold;">Reduce Goal:</span>
                        Add <strong>${adminNeeded} min</strong> Call Time
                    </div>
                `;
            } else {
                // Round Down (Target Low) -> Show Buffer (How much Work Time can be added / Call Time removed).
                // Target: Stay < 29.5.
                // Buffer = 29.5 - Current.
                const buffer = Math.floor(29.5 - minutesInHour);
                html = `
                    <div style="font-size: 0.9rem; text-align: center; color: var(--text-color); padding: 4px; background: rgba(0,0,0,0.05); border-radius: 4px;">
                        <span style="color: var(--success-text); font-weight: bold;">Buffer:</span>
                        ${buffer} min
                    </div>
                `;
            }
            if (DOMElements.targetStatsBar) DOMElements.targetStatsBar.innerHTML = html;
        }

        // --- 3. STRATEGY ENGINE ---
        function getStrategicAnalysis(data) {
            const { 
                ticketsDone, ticketsPerMinRate,
                minutesRemaining, nextGrade
            } = data;

            // REMOVED STRATEGY 1: ROUNDING OPTIMIZATION (Moved to Stats Bar)
            // STRATEGY 1: ROUNDING OPTIMIZATION
            if (isRoundedUp) {
                const minutesInHour = workTimeMinutes % 60; 
                const adminNeeded = minutesInHour - 29;
                
                if (adminNeeded <= 45) {
                    return {
                        type: 'optimization',
                        title: '📉 Reduce Goal',
                        text: `Your Net Work Time rounds <strong>UP</strong>. Add <strong>${Math.ceil(adminNeeded)} min</strong> to Call Time to drop the target by 6 tickets.`,
                        sub: `Current Goal: ${targetTicketGoal} → New Goal: ${targetTicketGoal - 6}`
                    };
                }
            }

            // STRATEGY 2: OPPORTUNITY ANALYSIS
            if (minutesRemaining > 0 && minutesRemaining < 90 && nextGrade) {
                const ticketsNeeded = nextGrade.val - ticketsDone;
                
                if (ticketsNeeded <= 5 && ticketsNeeded > 0) {
                    return {
                        type: 'opportunity',
                        title: `🎯 ${nextGrade.name} is Reachable`,
                        text: `<strong>${ticketsNeeded} tickets</strong> needed in ${minutesRemaining} mins.`
                    };
                }
                
                const minsPerTicketNeeded = minutesRemaining / ticketsNeeded;
                if (minsPerTicketNeeded < 8) {
                    return {
                        type: 'conservation',
                        title: '🛡️ Status Secured',
                        text: `Reaching ${nextGrade.name} is unlikely given the time remaining. Recommendation: Save completed tickets for tomorrow.`
                    };
                }
            }

            // STRATEGY 3: PACE ANALYSIS (Rate Check)
            if (minutesRemaining >= 90 && ticketsPerMinRate > 0 && ticketsPerMinRate < 0.08) {
                 return {
                     type: 'warn',
                     title: '⚠️ Pace Alert',
                     text: `Current pace is below the 6 tickets/hr requirement. Target is increasing faster than completions.`
                 };
            }

            // REMOVED INFO STRATEGY: Next Tier Gap (User request: Unnecessary)

            // Default fallback if no specific strategy
            return null;
        }

        function renderCalculationInfo(scheduleData, now) {
            const { totalWorkTimeEOD, currentTicketsSoFar, targetTicketGoal, shiftStartMinutes } = scheduleData;
            
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTimeMinutes = currentHour * 60 + currentMinute;
            const effectivePhoneCloseMinutes = Math.min(
                DateUtils.parseTimeToMinutes(DOMElements.shiftEnd.value),
                CONSTANTS.PHONE_CLOSE_MINUTES
            );
            
            const minutesUntilPhoneClose = effectivePhoneCloseMinutes - currentTimeMinutes;
            const minutesWorked = Math.max(1, currentTimeMinutes - shiftStartMinutes);

            const grades = [
                { name: 'Satisfactory', val: targetTicketGoal + gradeBoundaries.Satisfactory.min },
                { name: 'Excellent', val: targetTicketGoal + gradeBoundaries.Excellent.min },
                { name: 'Outstanding', val: targetTicketGoal + gradeBoundaries.Outstanding.min }
            ].sort((a,b) => a.val - b.val);
            const nextGrade = grades.find(g => g.val > currentTicketsSoFar);

            const analysis = getStrategicAnalysis({
                ticketsDone: currentTicketsSoFar,
                ticketsPerMinRate: currentTicketsSoFar / minutesWorked,
                minutesRemaining: minutesUntilPhoneClose,
                nextGrade: nextGrade
            });

            // Render Strategy Card if exists
            if (analysis) {
                const styleMap = {
                    'opportunity': 'strategy-warn',
                    'conservation': 'strategy-danger',
                    'warn': 'strategy-danger',
                    'info': 'strategy-normal',
                    'success': 'strategy-success'
                };

                const cardClass = styleMap[analysis.type] || '';
                const borderStyle = cardClass ? '' : 'border-left: 3px solid var(--border-color);';

                const html = `
                    <div class="strategy-card ${cardClass}" style="margin:0; box-shadow: 0 1px 2px rgba(0,0,0,0.05); ${borderStyle}">
                        <div class="strategy-title">${analysis.title}</div>
                        <div class="strategy-text">${analysis.text}</div>
                        ${analysis.sub ? `<div style="font-size:0.75rem; margin-top:4px; opacity:0.8; border-top:1px solid rgba(0,0,0,0.1); padding-top:2px;">${analysis.sub}</div>` : ''}
                    </div>
                `;
                DOMElements.calcInfoContent.innerHTML = html;
            } else {
                DOMElements.calcInfoContent.innerHTML = '';
            }
        }

        // --- STANDARD CALCULATIONS ---

        function getScheduleInfo(now) {
            const startMinutes = DateUtils.parseTimeToMinutes(DOMElements.shiftStart.value);
            const endMinutes = DateUtils.parseTimeToMinutes(DOMElements.shiftEnd.value);
            const breakTimeMinutes = parseInt(DOMElements.breakTime.value, 10) || 0;
            
            if (endMinutes <= startMinutes) return { error: "Check Shift Times" };

            const totalShiftMinutes = endMinutes - startMinutes;
            const postBreak = totalShiftMinutes - breakTimeMinutes;
            const leeway = postBreak * CONSTANTS.LEEWAY_RATIO;
            const totalProductiveMinutes = postBreak - leeway;

            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const minutesPassed = Math.max(0, Math.min(totalShiftMinutes, currentMinutes - startMinutes));
            
            const ratio = totalShiftMinutes > 0 ? minutesPassed / totalShiftMinutes : 0;
            const productiveMinutesPassed = totalProductiveMinutes * ratio;
            const productiveMinutesRemaining = totalProductiveMinutes - productiveMinutesPassed;

            return {
                totalProductiveMinutes,
                productiveMinutesRemaining,
                shiftStartMinutes: startMinutes
            };
        }

        function calculateDailyRatings() {
            const now = (window.APP_TIME_TRAVEL_DATE) ? new Date(window.APP_TIME_TRAVEL_DATE) : new Date();
            const { totalProductiveMinutes, productiveMinutesRemaining, shiftStartMinutes, error } = getScheduleInfo(now);

            if (error || totalProductiveMinutes <= 0) {
                 DOMElements.targetsGrid.innerHTML = `<div class="info-box info-box-danger" style="grid-column:1/-1">${error || "Invalid Config"}</div>`;
                 return;
            }

            const currentCallTimeSoFar = DateUtils.parseTimeToMinutes(DOMElements.currentCallTime.value);
            const currentTicketsSoFar = parseInt(DOMElements.currentTickets.value) || 0;

            // This matches the spreadsheet's "Total Work Time"
            const totalWorkTimeEOD = totalProductiveMinutes - currentCallTimeSoFar;
            
            // This matches the spreadsheet's "MROUND(..., '1:00')" logic
            const roundedWorkHours = Math.round(totalWorkTimeEOD / 60);
            
            // This matches the spreadsheet's "* 6" logic
            const targetTicketGoal = roundedWorkHours * CONSTANTS.TICKETS_PER_HOUR_RATE;

            DOMElements.totalWorkTimeEOD.innerText = DateUtils.formatMinutesToHHMM_Signed(totalWorkTimeEOD);
            if (DOMElements.baseTargetDisplay) DOMElements.baseTargetDisplay.innerText = targetTicketGoal;

            DOMElements.targetsGrid.innerHTML = '';
            for (const [targetName, boundary] of Object.entries(gradeBoundaries)) {
                const targetBox = document.createElement('div');
                const ticketsToHitGrade = targetTicketGoal + boundary.min;
                const ticketsNeeded = ticketsToHitGrade - currentTicketsSoFar;
                
                const { boxClass, html } = getTargetCardState({
                    boundary,
                    ticketsNeeded,
                    productiveMinutesRemaining
                });
                
                targetBox.className = `target-card ${boxClass}`;
                targetBox.innerHTML = html;
                DOMElements.targetsGrid.appendChild(targetBox);
            }

            renderTargetStats({ totalWorkTimeEOD });

            renderCalculationInfo({
                totalWorkTimeEOD,
                currentTicketsSoFar,
                targetTicketGoal,
                shiftStartMinutes
            }, now);
        }

        // --- EVENT LISTENERS ---
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

        function populateTimeOptions(select, startHour, endHour, defaultVal) {
            for (let h = startHour; h <= endHour; h++) {
                for (let m = 0; m < 60; m += 15) {
                    const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                    const opt = document.createElement('option');
                    opt.value = val;
                    opt.text = val;
                    if (val === defaultVal) opt.selected = true;
                    select.appendChild(opt);
                }
            }
        }
        populateTimeOptions(DOMElements.shiftStart, 6, 12, state.ui?.shiftStart || defaultState.ui.shiftStart);
        populateTimeOptions(DOMElements.shiftEnd, 12, 18, state.ui?.shiftEnd || defaultState.ui.shiftEnd);

        DOMElements.shiftStart.addEventListener('input', debouncedCalculateAndSave);
        DOMElements.shiftEnd.addEventListener('input', debouncedCalculateAndSave);
        DOMElements.breakTime.addEventListener('input', debouncedCalculateAndSave);
        DOMElements.currentCallTime.addEventListener('input', debouncedCalculateAndSave);
        DOMElements.currentTickets.addEventListener('input', debouncedCalculateAndSave);
        
        DOMElements.btnAddCallTime.addEventListener('click', () => {
            const current = DateUtils.parseTimeToMinutes(DOMElements.currentCallTime.value);
            const add = parseInt(DOMElements.addCallTime.value, 10) || 0;
            if (add === 0) return;
            DOMElements.currentCallTime.value = DateUtils.formatMinutesToHHMM(current + add);
            DOMElements.addCallTime.value = '';
            debouncedCalculateAndSave();
        });

        DOMElements.addCallTime.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') DOMElements.btnAddCallTime.click();
        });

        DOMElements.currentCallTime.addEventListener('blur', () => {
            const m = DateUtils.parseTimeToMinutes(DOMElements.currentCallTime.value);
            DOMElements.currentCallTime.value = DateUtils.formatMinutesToHHMM(m);
        });
        
        DOMElements.btnResetData.addEventListener('click', () => {
             SafeUI.showModal('Reset?', 'Reset data?', [{label:'Cancel'}, {label:'Reset', class:'button-danger', callback: handleResetData}]);
        });
        
        function handleResetData() {
            state.ui = JSON.parse(JSON.stringify(defaultState.ui));
            updateInputsFromState();
            calculateDailyRatings();
            saveState();
        }

        const allHeaders = document.querySelectorAll('.accordion-header');
        allHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                e.stopPropagation();
                const accordion = header.closest('.accordion');
                if (accordion) {
                    accordion.classList.toggle('expanded');
                    if (header.id === 'schedule-header') {
                         state.ui.isScheduleCollapsed = !accordion.classList.contains('expanded');
                         saveState();
                    }
                }
            });
        });

        const scheduleAccordion = document.getElementById('schedule-header')?.closest('.accordion');
        if (scheduleAccordion) {
            if (state.ui.isScheduleCollapsed) {
                scheduleAccordion.classList.remove('expanded');
            } else {
                scheduleAccordion.classList.add('expanded');
            }
        }

        setInterval(() => { if (document.visibilityState === 'visible') calculateDailyRatings(); }, 30000);

        updateInputsFromState();
        calculateDailyRatings();
        autoImportBookmarkletData();

        function autoImportBookmarkletData() {
            try {
                const mins = parseInt(localStorage.getItem(APP_CONFIG.IMPORT_KEY) || "0", 10);
                if (mins > 0) {
                    const cur = DateUtils.parseTimeToMinutes(DOMElements.currentCallTime.value);
                    DOMElements.currentCallTime.value = DateUtils.formatMinutesToHHMM(cur + mins);
                    localStorage.removeItem(APP_CONFIG.IMPORT_KEY);
                    debouncedCalculateAndSave();
                    SafeUI.showToast(`Imported ${mins} mins`);
                }
            } catch (e) { console.warn(e); }
        }
    })();
}
