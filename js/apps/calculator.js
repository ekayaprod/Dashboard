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

        // --- CONSTANTS ---
        const CONSTANTS = {
            TICKETS_PER_HOUR_RATE: 6,
            PHONE_CLOSE_MINUTES: 15 * 60 + 30, // 15:30
            LEEWAY_RATIO: 1 / 7
        };

        const CHECK_ICON = `<svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

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

        function getOrCreateTargetCard(container, targetName) {
            let card = container.querySelector(`[data-target-name="${targetName}"]`);
            if (!card) {
                card = document.createElement('div');
                card.setAttribute('data-target-name', targetName);
                // Initial creation - styling handled by update
                container.appendChild(card);
            }
            return card;
        }

        function buildTargetCardHTML(label, ticketText, callTimeText, isMet) {
            if (isMet) {
                return `
                <div style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; gap: 4px;">
                    <span class="target-label" style="font-weight:700;">${label}</span>
                    <span class="target-icon">${CHECK_ICON}</span>
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

        function updateTargetCard(card, data) {
            const { boundary, ticketsNeeded, callTimeDisplay, isMet, boxClass } = data;

            const prevState = card.getAttribute('data-met');
            const newState = isMet ? 'true' : 'false';

            // Apply Box Class
            card.className = `target-card ${boxClass}`;

            // Pulse Animation on Success
            if (prevState === 'false' && newState === 'true') {
                 card.classList.add('pulse-success');
                 setTimeout(() => card.classList.remove('pulse-success'), 600);
            }

            card.setAttribute('data-met', newState);

            // Rebuild HTML if state structure changes or empty
            if (prevState !== newState || !card.hasChildNodes()) {
                 card.innerHTML = buildTargetCardHTML(boundary.name, ticketsNeeded, callTimeDisplay, isMet);
                 return;
            }

            // Fine-grained updates for "Not Met" state to avoid flicker
            if (!isMet) {
                 const ticketEl = card.querySelector('.target-value:not(.target-alt-metric)');
                 const callTimeEl = card.querySelector('.target-alt-metric');

                 if (ticketEl && ticketEl.innerText !== String(ticketsNeeded)) {
                     ticketEl.innerText = ticketsNeeded;
                 }

                 if (callTimeEl && callTimeEl.innerText !== callTimeDisplay) {
                     callTimeEl.innerText = callTimeDisplay;
                 }
            }
        }

        function getTargetCardData(params) {
            const { boundary, ticketsNeeded, totalProductiveMinutes, currentTickets, currentCallTime } = params;

            if (ticketsNeeded <= 0) {
                return {
                    boundary,
                    ticketsNeeded: "",
                    callTimeDisplay: "",
                    isMet: true,
                    boxClass: 'target-good'
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
                boundary,
                ticketsNeeded: `${ticketsNeeded}`,
                callTimeDisplay,
                isMet: false,
                boxClass: 'target-warn'
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

            for (const [targetName, boundary] of Object.entries(gradeBoundaries)) {
                const ticketsToHitGrade = targetTicketGoal + boundary.min;
                const ticketsNeeded = ticketsToHitGrade - currentTicketsSoFar;
                
                const cardData = getTargetCardData({
                    boundary,
                    ticketsNeeded,
                    totalProductiveMinutes,
                    currentTickets: currentTicketsSoFar,
                    currentCallTime: currentCallTimeSoFar
                });
                
                const card = getOrCreateTargetCard(DOMElements.targetsGrid, targetName);
                updateTargetCard(card, cardData);
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
             SafeUI.showModal('Clear All?', 'Clear all data?', [{label:'Cancel'}, {label:'Clear All', class:'button-danger', callback: handleResetData}]);
        });
        
        function handleResetData() {
            state.ui = JSON.parse(JSON.stringify(defaultState.ui));
            updateInputsFromState();
            calculateDailyRatings();
            saveState();
        }

        const allHeaders = document.querySelectorAll('.accordion-header');
        allHeaders.forEach(header => {
            // Accessibility
            header.setAttribute('role', 'button');
            header.setAttribute('tabindex', '0');
            const accordion = header.closest('.accordion');
            const isExpanded = accordion && accordion.classList.contains('expanded');
            header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');

            const toggleAccordion = (e) => {
                if (e.target.closest('button, input, select, a') && e.target !== header) return;

                e.stopPropagation();
                if (accordion) {
                    accordion.classList.toggle('expanded');
                    const expanded = accordion.classList.contains('expanded');
                    header.setAttribute('aria-expanded', expanded ? 'true' : 'false');

                    if (header.id === 'schedule-header') {
                         state.ui.isScheduleCollapsed = !expanded;
                         saveState();
                    }
                }
            };

            header.addEventListener('click', toggleAccordion);
            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleAccordion(e);
                }
            });
        });

        const scheduleAccordion = document.getElementById('schedule-header')?.closest('.accordion');
        if (scheduleAccordion) {
            const header = document.getElementById('schedule-header');
            if (state.ui.isScheduleCollapsed) {
                scheduleAccordion.classList.remove('expanded');
                if (header) header.setAttribute('aria-expanded', 'false');
            } else {
                scheduleAccordion.classList.add('expanded');
                if (header) header.setAttribute('aria-expanded', 'true');
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
