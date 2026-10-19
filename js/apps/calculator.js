// ============================================================================
// PAGE-SPECIFIC LOGIC: Calculator (calculator.html)
// ============================================================================



/**
 * Initializes the Calculator application.
 * Sets up state management, loads previous data, and binds event listeners.
 */
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
                'target-stats-bar', 'btn-settings'
            ]
        });

        if (!ctx) return;

        const { elements: DOMElements, state, saveState } = ctx;

        if (window.SharedSettingsModal) {
            window.SharedSettingsModal.init({
                buttonId: 'btn-settings',
                appName: APP_CONFIG.NAME,
                state: state,
                onRestoreCallback: (restoredData) => {
                    Object.assign(state, restoredData);
                    saveState();
                    updateInputsFromState();
                    calculateDailyRatings();
                    UIUtils.showToast('Calculator settings restored successfully.');
                }
            });
        }

        // --- CONSTANTS ---
        const CONSTANTS = {
            TICKETS_PER_HOUR_RATE: 6,
            PHONE_CLOSE_MINUTES: 15 * 60 + 30, // 15:30
            // Mathematical multiplier for a ~14.2% downtime buffer based on legacy business rules
            LEEWAY_RATIO: 1 / 7
        };

        const COPY = {
            TARGETS: {
                OUTSTANDING: 'Outstanding',
                EXCELLENT: 'Excellent',
                SATISFACTORY: 'Satisfactory',
            },
            STATUS: {
                MET: 'Goal Met!',
                MET_SUB: 'Great job!',
                TICKETS_REMAINING: 'Total Tickets',
                CALL_TIME: 'Total Call Time',
                OR: '— OR —',
                NA: 'N/A',
                OVER_SHIFT: '> Shift',
                ADD_PREFIX: 'Add ',
                MIN_SUFFIX: 'm',
            },
            BUFFER: {
                SPIKE_TITLE: 'Target Jump (+6)',
                SPIKE_ACTION: (mins) => `Add <strong>${mins} min</strong> to reduce target.`,
                SAFE_LABEL: 'Safe buffer until target increase',
            },
            STRATEGY: {
                QUICK_FIX_TITLE: '📉 Quick Fix',
                QUICK_FIX_BODY: (mins) => `You're just <strong>${mins} min</strong> over. Add a little Call Time to drop your goal by 6.`,
            },
            ERRORS: {
                CHECK_TIMES: "Check Shift Times",
                INVALID: "Invalid Settings",
            },
            MODALS: {
                RESET_TITLE: 'Start Fresh?',
                RESET_BODY: 'Reset all data to defaults?',
                CANCEL: 'Cancel',
                CONFIRM_RESET: 'Reset',
            },
            TOASTS: {
                RESTORED: (mins) => `Restored ${mins} mins`,
            }
        };

        const CHECK_ICON = `<svg aria-hidden="true" focusable="false" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

        const gradeBoundaries = {
            [COPY.TARGETS.OUTSTANDING]: { name: COPY.TARGETS.OUTSTANDING, min: 7, max: Infinity },
            [COPY.TARGETS.EXCELLENT]: { name: COPY.TARGETS.EXCELLENT, min: 4, max: 6 },
            [COPY.TARGETS.SATISFACTORY]: { name: COPY.TARGETS.SATISFACTORY, min: -3, max: 3 }
        };

        // --- 1. CORE LOGIC: REQUIRED CALL TIME ---
        
        // 🕯️ CHRONICLE: AST logic checks how much extra call time is required to hit target jump boundary thresholds. Added in PR #368 for dynamic buffer visibility.
        /**
         * Calculates how much additional Call Time is needed to drop the target 
         * such that the CURRENT ticket count satisfies the grade requirement.
         *
         * Formula Logic:
         * 1. MaxRoundedHours = floor((CurrentTickets - Offset) / 6)
         * 2. RequiredTotalCallTime = floor(Prod - (60 * MaxRoundedHours) - 30) + 1
         *
         * @param {number} totalProductiveMinutes - Total minutes in the shift excluding breaks and leeway.
         * @param {number} currentTickets - The number of tickets currently completed.
         * @param {number} offset - The grade boundary offset (e.g., +7 for Outstanding, -3 for Satisfactory).
         * @param {number} currentCallTime - The current call time in minutes.
         * @returns {number} The additional call time needed in minutes (min 0), or Infinity if unreachable.
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

        /**
         * Finds or creates a target card element within the container.
         *
         * @param {HTMLElement} container - The parent container.
         * @param {string} targetName - The unique identifier for the target (e.g., 'Excellent').
         * @returns {HTMLElement} The existing or newly created card element.
         */
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

        /**
         * Generates the HTML content for a target card.
         *
         * @param {string} label - The target name (e.g., 'Outstanding').
         * @param {string|number} ticketText - Text displaying tickets needed.
         * @param {string} callTimeText - Text displaying call time needed.
         * @param {boolean} isMet - Whether the target has been met.
         * @returns {string} HTML string.
         */
        function buildTargetCardHTML(label, ticketText, callTimeText, isMet) {
            if (isMet) {
                return `
                <div class="target-card-success-state">
                    <span class="target-label" style="font-weight:700;">${label}</span>
                    <span class="target-icon">${CHECK_ICON}</span>
                    <span style="font-size:0.8rem; opacity:0.9;">${COPY.STATUS.MET}</span>
                    <span style="font-size:0.65rem; opacity:0.8;">${COPY.STATUS.MET_SUB}</span>
                </div>
                `;
            }

            // Note: target-alt-metric class is used for high-contrast overrides in CSS (White Text)
            return `
                <div class="target-card-unmet-state">
                    <span class="target-label">${label}</span>
                    
                    <!-- Path 1: Tickets -->
                    <div class="target-path">
                        <span class="target-value" style="font-size:1.1rem;">${ticketText}</span>
                        <span style="font-size:0.65rem; text-transform:uppercase; opacity:0.7;">${COPY.STATUS.TICKETS_REMAINING}</span>
                    </div>

                    <!-- Divider -->
                    <div class="target-divider">${COPY.STATUS.OR}</div>

                    <!-- Path 2: Call Time -->
                    <div class="target-path">
                         <span class="target-value target-alt-metric" style="font-size:1.0rem;">${callTimeText}</span>
                         <span style="font-size:0.65rem; text-transform:uppercase; opacity:0.7;">${COPY.STATUS.CALL_TIME}</span>
                    </div>
                </div>
            `;
        }

        /**
         * Updates the visual state of a target card.
         * Applies animations and efficient DOM updates to minimize flickering.
         *
         * @param {HTMLElement} card - The card element to update.
         * @param {Object} data - The display data for the card.
         * @param {Object} data.boundary - The grade boundary configuration.
         * @param {string|number} data.ticketsNeeded - Tickets needed to hit target.
         * @param {string} data.callTimeDisplay - Call time needed text.
         * @param {boolean} data.isMet - Whether the target is met.
         * @param {string} data.boxClass - CSS class for color coding (e.g., 'target-good').
         */
        function updateTargetCard(card, data) {
            const { boundary, ticketsText, callTimeDisplay, isMet, boxClass } = data;

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
                 card.innerHTML = buildTargetCardHTML(boundary.name, ticketsText, callTimeDisplay, isMet);
                 return;
            }

            // Fine-grained updates for "Not Met" state to avoid flicker
            if (!isMet) {
                 const ticketEl = card.querySelector('.target-value:not(.target-alt-metric)');
                 const callTimeEl = card.querySelector('.target-alt-metric');

                 if (ticketEl && ticketEl.innerText !== String(ticketsText)) {
                     ticketEl.innerText = ticketsText;
                 }

                 if (callTimeEl && callTimeEl.innerText !== callTimeDisplay) {
                     callTimeEl.innerText = callTimeDisplay;
                 }
            }
        }

        /**
         * Computes the display data for a single target card.
         * Determines if the target is met and calculates the "Alternative Path" (Call Time) if not.
         *
         * @param {Object} params - The calculation parameters.
         * @param {Object} params.boundary - The grade boundary.
         * @param {number} params.ticketsNeeded - Raw calculation of tickets remaining.
         * @param {number} params.totalProductiveMinutes - Productive time.
         * @param {number} params.currentTickets - Current ticket count.
         * @param {number} params.currentCallTime - Current call time.
         * @returns {Object} Data object suitable for `updateTargetCard`.
         */
        function getTargetCardData(params) {
            const { boundary, ticketsNeeded, totalProductiveMinutes, currentTickets, currentCallTime, ticketsToHitGrade, shiftDurationMinutes } = params;

            if (ticketsNeeded <= 0) {
                return {
                    boundary,
                    ticketsText: "",
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
                callTimeDisplay = COPY.STATUS.NA;
            } else {
                const requiredTotalCallTime = currentCallTime + additionalCallTime;
                if (requiredTotalCallTime > shiftDurationMinutes) {
                    callTimeDisplay = COPY.STATUS.OVER_SHIFT;
                } else {
                    const hours = Math.floor(requiredTotalCallTime / 60);
                    const minutes = requiredTotalCallTime % 60;
                    callTimeDisplay = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                }
            }

            return {
                boundary,
                ticketsText: `${ticketsToHitGrade}`,
                callTimeDisplay,
                isMet: false,
                boxClass: 'target-warn'
            };
        }

        // --- 3. STATS BAR (BUFFER) ---

        /**
         * Renders the buffer status bar showing exact minutes of call time needed to drop the ticket target by 6.
         *
         * @param {number} minutesInHour - The minute component of the total work time (0-59).
         */
        function renderTargetDrop(minutesInHour) {
            const dropNeeded = minutesInHour >= 30 ? Math.ceil(minutesInHour - 29) : Math.ceil(minutesInHour + 31);
            
            const html = `
                <div style="font-size: 0.85rem; text-align: center; color: var(--text-color); padding: 4px; background: rgba(0,0,0,0.05); border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);">
                    <span style="color: var(--text-color); font-weight: bold;">Drop goal by 6 tickets</span><br>
                    Add <strong>${dropNeeded} min</strong> Call Time.
                </div>
            `;
            
            if (DOMElements.targetStatsBar) DOMElements.targetStatsBar.innerHTML = html;
        }

        // --- 4. PACING GUIDE ---

        /**
         * Renders the pacing guide to show the pace needed to hit unmet targets.
         *
         * @param {Date} now - Current time context.
         * @param {number} shiftStartMinutes - Shift start time in minutes.
         * @param {number} shiftEndMinutes - Shift end time in minutes.
         * @param {number} currentTicketsSoFar - Current tickets completed.
         * @param {number} targetTicketGoal - Target base tickets.
         */
        function renderPacingGuide(now, shiftStartMinutes, shiftEndMinutes, currentTicketsSoFar, targetTicketGoal) {
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            let shiftMinutesRemaining = shiftEndMinutes - Math.max(shiftStartMinutes, currentMinutes);
            
            if (shiftMinutesRemaining <= 0) {
                DOMElements.calcInfoContent.innerHTML = '';
                return;
            }

            const shiftHoursRemaining = shiftMinutesRemaining / 60;

            let html = '<div class="strategy-card" style="margin:0; border-radius: 0.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);"><div class="strategy-title" style="margin-bottom: 8px;">Pacing Guide</div><div class="strategy-text" style="display: grid; gap: 8px;">';

            let hasUnmet = false;
            for (const [targetName, boundary] of Object.entries(gradeBoundaries)) {
                const ticketsToHitGrade = targetTicketGoal + boundary.min;
                const ticketsNeeded = ticketsToHitGrade - currentTicketsSoFar;

                if (ticketsNeeded > 0) {
                    hasUnmet = true;
                    const pacePerHour = (ticketsNeeded / shiftHoursRemaining).toFixed(1);
                    const minsPerTicket = (shiftMinutesRemaining / ticketsNeeded).toFixed(0);

                    html += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                            <span style="font-weight: 600;">${targetName}</span>
                            <span style="font-size: 0.85rem;">
                                ${pacePerHour} t/hr <span style="opacity: 0.5;">|</span> ${minsPerTicket} m/t
                            </span>
                        </div>
                    `;
                }
            }

            html += '</div></div>';

            if (hasUnmet) {
                DOMElements.calcInfoContent.innerHTML = html;
            } else {
                DOMElements.calcInfoContent.innerHTML = '';
            }
        }

        // --- STANDARD CALCULATIONS ---

        /**
         * Retrieves and calculates schedule details based on UI inputs.
         *
         * @param {Date} now - The current date/time (used for context, though currently unused in calculation logic).
         * @returns {{totalProductiveMinutes: number, shiftStartMinutes: number}|{error: string}}
         *          Object containing productive minutes and start time, or an error object.
         */
        function getScheduleInfo(now) {
            const startMinutes = DateUtils.parseTimeToMinutes(DOMElements.shiftStart.value);
            const endMinutes = DateUtils.parseTimeToMinutes(DOMElements.shiftEnd.value);
            const breakTimeMinutes = parseInt(DOMElements.breakTime.value, 10) || 0;
            
            if (endMinutes <= startMinutes) return { error: COPY.ERRORS.CHECK_TIMES };

            const totalShiftMinutes = endMinutes - startMinutes;
            const postBreak = totalShiftMinutes - breakTimeMinutes;
            const leeway = postBreak * CONSTANTS.LEEWAY_RATIO;
            const totalProductiveMinutes = postBreak - leeway;

            return {
                totalProductiveMinutes,
                shiftStartMinutes: startMinutes,
                shiftEndMinutes: endMinutes
            };
        }

        /**
         * Main calculation loop.
         * Reads inputs, computes productive time, determines targets, and updates the UI.
         *
         * Steps:
         * 1. Get schedule info (productive minutes).
         * 2. Calculate Total Work Time (Productive - Call Time).
         * 3. Determine if rounding is pushing the target up (XX:30 threshold).
         * 4. Update Target Cards and Stats Bar.
         */
        function calculateDailyRatings() {
            const now = (window.APP_TIME_TRAVEL_DATE) ? new Date(window.APP_TIME_TRAVEL_DATE) : new Date();
            const { totalProductiveMinutes, shiftStartMinutes, shiftEndMinutes, error } = getScheduleInfo(now);

            if (error || totalProductiveMinutes <= 0) {
                 DOMElements.targetsGrid.innerHTML = `<div class="info-box info-box-danger" style="grid-column:1/-1">${error || COPY.ERRORS.INVALID}</div>`;
                 return;
            }

            const shiftDurationMinutes = shiftEndMinutes - shiftStartMinutes;
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
                    currentCallTime: currentCallTimeSoFar,
                    ticketsToHitGrade,
                    shiftDurationMinutes
                });
                
                const card = getOrCreateTargetCard(DOMElements.targetsGrid, targetName);
                updateTargetCard(card, cardData);
            }

            renderTargetDrop(minutesInHour);
            renderPacingGuide(now, shiftStartMinutes, shiftEndMinutes, currentTicketsSoFar, targetTicketGoal);
        }

        // --- EVENT LISTENERS ---

        /**
         * Synchronizes the DOM input values with the current application state.
         * Ensures that the UI reflects loaded data or defaults on startup.
         */
        function updateInputsFromState() {
            if (!state.ui) state.ui = { ...defaultState.ui };
            DOMElements.shiftStart.value = state.ui.shiftStart || defaultState.ui.shiftStart;
            DOMElements.shiftEnd.value = state.ui.shiftEnd || defaultState.ui.shiftEnd;
            DOMElements.breakTime.value = isNaN(state.ui.breakTime) ? defaultState.ui.breakTime : state.ui.breakTime;
            DOMElements.currentCallTime.value = state.ui.currentCallTime || '00:00';
            DOMElements.currentTickets.value = isNaN(state.ui.currentTickets) ? 0 : state.ui.currentTickets;
        }

        /**
         * Wrapper to debounce calculation and save operations.
         * Prevents excessive calculations during rapid input.
         *
         * Actions:
         * 1. Reads current DOM values into state.
         * 2. Persists state to localStorage.
         * 3. Triggers calculation of daily ratings.
         */
        const debouncedCalculateAndSave = UIUtils.debounce(() => {
            state.ui.shiftStart = DOMElements.shiftStart.value;
            state.ui.shiftEnd = DOMElements.shiftEnd.value;
            state.ui.breakTime = parseInt(DOMElements.breakTime.value, 10) || 0;
            state.ui.currentCallTime = DOMElements.currentCallTime.value;
            state.ui.currentTickets = parseInt(DOMElements.currentTickets.value, 10) || 0;
            saveState();
            calculateDailyRatings();
        }, 250);

        /**
         * Populates a select element with time options in 15-minute increments.
         *
         * @param {HTMLSelectElement} select - The select element to populate.
         * @param {number} startHour - The starting hour (0-23).
         * @param {number} endHour - The ending hour (0-23).
         * @param {string} defaultVal - The value to mark as selected (e.g., "08:00").
         */
        function populateTimeOptions(select, startHour, endHour, defaultVal) {
            for (let h = startHour; h <= endHour; h++) {
                for (let m = 0; m < 60; m += 15) {
                    const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                    select.appendChild(DOMHelpers.createOption(val, val, { selected: val === defaultVal }));
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
             handleResetData();
             UIUtils.showToast('Data reset.');
        });
        
        /**
         * Resets the application state to default values and updates the UI.
         */
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

            /**
             * Toggles the expansion state of the accordion.
             * Saves the state preference for the Schedule accordion.
             *
             * @param {Event} e - The click or keydown event.
             */
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

        /**
         * Checks for data left by legacy bookmarklets in localStorage.
         * If found, imports the call time minutes into the current session and clears the legacy key.
         */
        function autoImportBookmarkletData() {
            try {
                const mins = parseInt(localStorage.getItem(APP_CONFIG.IMPORT_KEY) || "0", 10);
                if (mins > 0) {
                    const cur = DateUtils.parseTimeToMinutes(DOMElements.currentCallTime.value);
                    DOMElements.currentCallTime.value = DateUtils.formatMinutesToHHMM(cur + mins);
                    localStorage.removeItem(APP_CONFIG.IMPORT_KEY);
                    debouncedCalculateAndSave();
                    UIUtils.showToast(COPY.TOASTS.RESTORED(mins));
                }
            } catch (e) { console.warn(e); }
        }
    })();
}

// ============================================================================
// BOOTSTRAP LOGIC
// ============================================================================
if (typeof AppLifecycle !== 'undefined') {
    AppLifecycle.onBootstrap(initializePage);
} else {
    if (window.__BOOTSTRAP_READY) {
        initializePage();
    } else {
        document.addEventListener('bootstrap:ready', () => {
            if (typeof AppLifecycle !== 'undefined') {
                AppLifecycle.onBootstrap(initializePage);
            } else {
                initializePage();
            }
        });
    }
}
