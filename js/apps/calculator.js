// ============================================================================
// PAGE-SPECIFIC LOGIC: Calculator (calculator.html)
// ============================================================================

AppLifecycle.onBootstrap(initializePage);

function initializePage() {
    const APP_CONFIG = {
        NAME: 'calculator',
        VERSION: '3.8.2', // Updated: Safe Zone Countdown & Terminology
        DATA_KEY: 'eod_targets_state_v1',
        IMPORT_KEY: 'eod_targets_import_minutes'
    };

    /**
     * ============================================================================
     * FORMULA LOGIC
     * ============================================================================
     * Target Formula: 
     * NetWorkTime = TotalProductiveMinutes - CallTime
     * RoundedHours = Round(NetWorkTime / 60)
     * TargetTickets = RoundedHours * 6
     * * Grade Thresholds:
     * Outstanding: Tickets >= Target + 7
     * Excellent:   Tickets >= Target + 4
     * Satisfactory: Tickets >= Target - 3
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
        
        // Fix Label Reference (removing "Admin" from UI if present)
        const callLabel = document.querySelector('label[for="currentCallTime"]');
        if (callLabel) callLabel.innerText = "Call Time";

        // --- CONSTANTS ---
        const CONSTANTS = {
            TICKETS_PER_HOUR_RATE: 6,
            PHONE_CLOSE_MINUTES: 15 * 60 + 30, // 15:30
            LEEWAY_RATIO: 1 / 7
        };

        const gradeBoundaries = {
            'Outstanding': { name: 'Outstanding', min: 7, max: Infinity },
            'Excellent': { name: 'Excellent', min: 4, max: 6 },
            'Satisfactory': { name: 'Satisfactory', min: -3, max: 3 }
        };

        // --- 1. CORE LOGIC: REQUIRED CALL TIME ---
        
        /**
         * Calculates how much additional Call Time is needed to drop the target 
         * such that the CURRENT ticket count satisfies the grade requirement.
         */
        function calculateAdditionalCallTimeNeeded(totalProductiveMinutes, currentTickets, offset, currentCallTime) {
            // Logic:
            // We need: CurrentTickets >= (Round((Prod - TotalCallTime)/60) * 6) + Offset
            // (CurrentTickets - Offset) / 6 >= Round((Prod - TotalCallTime)/60)
            
            // Let MaxRoundedHours be the maximum rounded work hours we can afford.
            // MaxRoundedHours = floor((CurrentTickets - Offset) / 6)
            const maxRoundedHours = Math.floor((currentTickets - offset) / 6);

            // If MaxRoundedHours < 0, it means even 0 work hours (Target 0) isn't enough.
            if (maxRoundedHours < 0) return Infinity;

            // We need: Round((Prod - TotalCallTime)/60) <= MaxRoundedHours
            // Threshold for Round(X) <= K is X < K + 0.5
            // (Prod - TotalCallTime)/60 < MaxRoundedHours + 0.5
            // Prod - TotalCallTime < 60 * MaxRoundedHours + 30
            // TotalCallTime > Prod - 60 * MaxRoundedHours - 30
            
            // Minimum Integer Total Call Time:
            const requiredTotalCallTime = Math.floor(totalProductiveMinutes - (60 * maxRoundedHours) - 30) + 1;
            
            // Additional needed:
            const additional = requiredTotalCallTime - currentCallTime;
            
            // If additional is negative, we already have enough call time.
            return Math.max(0, additional);
        }

        // --- 2. DASHBOARD BADGES ---

        function buildTargetCardHTML(label, ticketText, callTimeText, isMet) {
            if (isMet) {
                return `
                <div style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; gap: 4px;">
                    <span class="target-label" style="font-weight:700;">${label}</span>
                    <span style="font-size:1.5rem; line-height:1;">✓</span>
                    <span style="font-size:0.8rem; opacity:0.9;">Met</span>
                </div>
                `;
            }

            // Note: target-alt-metric class is used for high-contrast overrides in CSS (White Text)
            return `
                <div style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; gap: 1px;">
                    <span class="target-label">${label}</span>
                    
                    <!-- Path 1: Tickets -->
                    <div style="display:flex; flex-direction:column; align-items:center; line-height:1.1;">
                        <span class="target-value" style="font-size:1.1rem;">${ticketText}</span>
                        <span style="font-size:0.65rem; text-transform:uppercase; opacity:0.7;">Tickets Needed</span>
                    </div>

                    <!-- Divider -->
                    <div style="font-size:0.6rem; opacity:0.5; text-align:center; margin:1px 0;">— OR —</div>

                    <!-- Path 2: Call Time -->
                    <div style="display:flex; flex-direction:column; align-items:center; line-height:1.1;">
                         <span class="target-value target-alt-metric" style="font-size:1.0rem;">${callTimeText}</span>
                         <span style="font-size:0.65rem; text-transform:uppercase; opacity:0.7;">Call Time</span>
                    </div>
                </div>
            `;
        }

        function getTargetCardState(params) {
            const { boundary, ticketsNeeded, totalProductiveMinutes, currentTickets, currentCallTime } = params;

            if (ticketsNeeded <= 0) {
                return {
                    boxClass: 'target-good',
                    html: buildTargetCardHTML(boundary.name, "", "", true)
                };
            }

            // Calculate Alternative Path: Call Time
            const additionalCallTime = calculateAdditionalCallTimeNeeded(
                totalProductiveMinutes, 
                currentTickets, 
                boundary.min, 
                currentCallTime
            );

            let callTimeDisplay;
            if (additionalCallTime === Infinity) {
                callTimeDisplay = "N/A";
            } else if (additionalCallTime > 480) {
                callTimeDisplay = "> Shift";
            } else {
                callTimeDisplay = `Add ${additionalCallTime}m`;
            }

            return {
                boxClass: 'target-warn',
                html: buildTargetCardHTML(
                    boundary.name, 
                    `${ticketsNeeded}`, 
                    callTimeDisplay, 
                    false
                )
            };
        }

        // --- 3. STATS BAR (BUFFER) ---
        function renderTargetStats(data) {
            const { isRoundedUp, minutesInHour } = data;
            
            let html = '';

            // BUFFER LOGIC:
            // Threshold is XX:30.
            
            if (isRoundedUp) {
                // Scenario: Net Work Time is XX:30 or greater.
                // Rounding has pushed the target UP.
                // Action: Add Call Time to reduce Net Work Time below XX:30.
                const reduceNeeded = Math.ceil(minutesInHour - 29);
                html = `
                    <div style="font-size: 0.85rem; text-align: center; color: var(--text-color); padding: 4px; background: rgba(0,0,0,0.05); border-radius: 4px;">
                        <span style="color: var(--warning-text); font-weight: bold;">Target Elevated (+6 Tickets)</span><br>
                        Add <strong>${reduceNeeded} min</strong> Call Time to drop back
                    </div>
                `;
            } else {
                // Scenario: Net Work Time is XX:00 to XX:29.
                // Target is currently Lower.
                // Countdown: How many minutes of WORK remaining until we hit XX:30 and target jumps?
                const buffer = Math.floor(30 - minutesInHour);
                
                // Color logic: Green when plenty of time, Red when close to 0
                let colorStyle = 'color: var(--success-text);';
                if (buffer <= 5) colorStyle = 'color: var(--danger-color);'; 
                else if (buffer <= 10) colorStyle = 'color: var(--warning-text);';

                html = `
                    <div style="font-size: 0.9rem; text-align: center; color: var(--text-color); padding: 6px; background: rgba(0,0,0,0.05); border-radius: 4px;">
                        <span style="${colorStyle} font-weight: bold; font-size: 1.1rem;">${buffer} min</span><br>
                        <span style="font-size: 0.75rem; opacity: 0.8;">work time until Target Increases (+6)</span>
                    </div>
                `;
            }
            if (DOMElements.targetStatsBar) DOMElements.targetStatsBar.innerHTML = html;
        }

        // --- 4. STRATEGY ENGINE ---
        function renderCalculationInfo(scheduleData, now) {
            const { minutesInHour, isRoundedUp } = scheduleData;
            
            let analysis = null;

            if (isRoundedUp && (minutesInHour - 29) <= 20) {
                 analysis = {
                    type: 'optimization',
                    title: '📉 Easy Win',
                    text: `You are only <strong>${Math.ceil(minutesInHour - 29)} min</strong> over the threshold. Adding this small amount of Call Time will lower your ticket goal by 6.`
                 };
            }

            if (analysis) {
                 const html = `
                    <div class="strategy-card strategy-success" style="margin:0; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                        <div class="strategy-title">${analysis.title}</div>
                        <div class="strategy-text">${analysis.text}</div>
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

            return {
                totalProductiveMinutes,
                shiftStartMinutes: startMinutes
            };
        }

        function calculateDailyRatings() {
            const now = (window.APP_TIME_TRAVEL_DATE) ? new Date(window.APP_TIME_TRAVEL_DATE) : new Date();
            const { totalProductiveMinutes, shiftStartMinutes, error } = getScheduleInfo(now);

            if (error || totalProductiveMinutes <= 0) {
                 DOMElements.targetsGrid.innerHTML = `<div class="info-box info-box-danger" style="grid-column:1/-1">${error || "Invalid Config"}</div>`;
                 return;
            }

            const currentCallTimeSoFar = DateUtils.parseTimeToMinutes(DOMElements.currentCallTime.value);
            const currentTicketsSoFar = parseInt(DOMElements.currentTickets.value) || 0;

            // This matches the spreadsheet's "Total Work Time"
            const totalWorkTimeEOD = totalProductiveMinutes - currentCallTimeSoFar;
            
            // Rounding Logic: .5 rounds UP
            const minutesInHour = totalWorkTimeEOD % 60;
            const isRoundedUp = minutesInHour >= 30; // STRICT THRESHOLD

            // Calculate Target
            const roundedWorkHours = Math.round(totalWorkTimeEOD / 60);
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
                    totalProductiveMinutes,
                    currentTickets: currentTicketsSoFar,
                    currentCallTime: currentCallTimeSoFar
                });
                
                targetBox.className = `target-card ${boxClass}`;
                targetBox.innerHTML = html;
                DOMElements.targetsGrid.appendChild(targetBox);
            }

            renderTargetStats({ totalWorkTimeEOD, isRoundedUp, minutesInHour });
            renderCalculationInfo({ minutesInHour, isRoundedUp }, now);
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
