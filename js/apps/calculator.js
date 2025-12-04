// ============================================================================
// PAGE-SPECIFIC LOGIC: Calculator (calculator.html)
// ============================================================================

AppLifecycle.onBootstrap(initializePage);

function initializePage() {
    const APP_CONFIG = {
        NAME: 'calculator',
        VERSION: '3.1.0', // Professional Strategy Edition
        DATA_KEY: 'eod_targets_state_v1',
        IMPORT_KEY: 'eod_targets_import_minutes'
    };

    (async () => {
        // --- Dependency Check ---
        if (typeof SafeUI === 'undefined' || !SafeUI.isReady || typeof DOMHelpers === 'undefined' || typeof UIPatterns === 'undefined' || typeof SharedSettingsModal === 'undefined' || typeof BackupRestore === 'undefined') {
            const banner = document.getElementById('app-startup-error');
            if (banner) {
                banner.innerHTML = `<strong>Application Failed to Load</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">Critical dependencies missing.</p>`;
                banner.classList.remove('hidden');
            }
            return;
        }

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
                'totalWorkTimeEOD', 'baseTargetDisplay',
                'targets-grid', 'btnResetData', 'calc-info-content',
                'schedule-header', 'schedule-content', 'schedule-collapse-icon'
            ]
        });

        if (!ctx) return;

        const { elements: DOMElements, state, saveState } = ctx;

        // --- CONSTANTS ---
        const CONSTANTS = {
            TICKETS_PER_HOUR_RATE: 6,
            ROUNDING_BOUNDARY_MAX: 29, // Minutes :29 rounds down
            PHONE_CLOSE_MINUTES: 15 * 60 + 30, // 15:30
            LEEWAY_RATIO: 1 / 7
        };

        const gradeBoundaries = {
            'Outstanding': { name: 'Outstanding', min: 7, max: Infinity },
            'Excellent': { name: 'Excellent', min: 4, max: 6 },
            'Satisfactory': { name: 'Satisfactory', min: -3, max: 3 }
        };

        const TimeUtil = {
            ...DateUtils,
            parseShiftTimeToMinutes(timeStr) {
                const parts = timeStr.split(':').map(Number);
                return (parts[0] * 60) + parts[1];
            }
        };

        // --- 1. TARGET CARDS (The Status Board) ---
        function buildTargetCardHTML(label, value, description) {
            return `
                <div style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; gap: 2px;">
                    <span class="target-label">${label}</span>
                    <span class="target-value">${value}</span>
                    <span class="target-desc">${description}</span>
                </div>
            `;
        }

        function getTargetCardState({ boundary, ticketsNeeded, productiveMinutesRemaining }) {
            // Scenario: Goal Met
            if (ticketsNeeded <= 0) {
                return {
                    boxClass: 'target-good',
                    html: buildTargetCardHTML(boundary.name, "Met", "Target Achieved")
                };
            }

            // Scenario: Shift Ended / Time Up
            if (productiveMinutesRemaining <= 0) {
                 return {
                    boxClass: 'target-danger',
                    html: buildTargetCardHTML(boundary.name, `-${ticketsNeeded}`, `Missed`)
                };
            }

            // Scenario: In Progress
            return {
                boxClass: 'target-warn',
                html: buildTargetCardHTML(boundary.name, ticketsNeeded, `Remaining`)
            };
        }

        // --- 2. STRATEGY ENGINE (Analysis & Recommendations) ---
        
        function getStrategicAnalysis(data) {
            // Extract Data
            const { 
                workTimeMinutes, // Total minutes allocated to tickets
                ticketsDone, 
                ticketsPerMinRate, // Current speed
                minutesRemaining, // Until phone close
                nextGrade, // Object {name, val}
                isRoundedUp // Boolean: Is the target currently inflated?
            } = data;

            // STRATEGY 1: ROUNDING OPTIMIZATION
            // If the target is rounded up (XX:30+), we check if adding Admin/Call time lowers it.
            if (isRoundedUp) {
                const minutesOver30 = workTimeMinutes % 60; 
                // Target is :29. Calculate difference.
                const adminNeeded = minutesOver30 - 29;
                
                // If the adjustment is reasonable (e.g., < 45 mins)
                if (adminNeeded <= 45) {
                    return {
                        type: 'optimization',
                        title: '📉 Efficiency Optimization',
                        text: `Allocating <strong>${Math.ceil(adminNeeded)} min</strong> to Admin/Call Time will reduce the target tier by 6 tickets.`
                    };
                }
            }

            // STRATEGY 2: OPPORTUNITY ANALYSIS (End of Shift)
            // If < 90 mins left, check feasibility of next grade.
            if (minutesRemaining > 0 && minutesRemaining < 90 && nextGrade) {
                const ticketsNeeded = nextGrade.val - ticketsDone;
                
                // FEASIBLE: Close to target
                if (ticketsNeeded <= 5 && ticketsNeeded > 0) {
                    return {
                        type: 'opportunity',
                        title: `🎯 Goal Within Reach: ${nextGrade.name}`,
                        text: `<strong>${ticketsNeeded} tickets</strong> needed in ${minutesRemaining} mins to reach the next tier.`
                    };
                }
                
                // STRATEGY 3: CONSERVATION (Not Feasible)
                // Threshold: If we need more than 1 ticket every 8 mins (High intensity)
                const minsPerTicketNeeded = minutesRemaining / ticketsNeeded;
                if (minsPerTicketNeeded < 8) {
                    return {
                        type: 'conservation',
                        title: '🛡️ Status: Secured',
                        text: `${nextGrade.name} tier is statistically unlikely. Recommendation: Maintain current status and prioritize quality or admin tasks.`
                    };
                }
            }

            // STRATEGY 4: PACE ANALYSIS (Mid Shift)
            // If early in shift (>= 90 mins left), check if pace matches growth.
            if (minutesRemaining >= 90) {
                 // Target growth rate is 6/hr = 0.1/min.
                 // If current rate is < 0.08 (4.8/hr)
                 if (ticketsPerMinRate > 0 && ticketsPerMinRate < 0.08) {
                     return {
                         type: 'warn',
                         title: '⚠️ Pace Alert',
                         text: `Current output (${(ticketsPerMinRate*60).toFixed(1)}/hr) is below target accumulation rate.`
                     };
                 }
            }

            // Default: Standard Progress
            if (nextGrade) {
                return {
                    type: 'info',
                    title: `Next Objective: ${nextGrade.name}`,
                    text: `Gap: <strong>${nextGrade.val - ticketsDone} tickets</strong>.`
                };
            }

            return {
                type: 'success',
                title: '🏆 Targets Maximized',
                text: 'Highest tier achieved.'
            };
        }

        function renderCalculationInfo(scheduleData, now) {
            const { totalWorkTimeEOD, currentTicketsSoFar, targetTicketGoal, shiftStartMinutes } = scheduleData;
            
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTimeMinutes = currentHour * 60 + currentMinute;
            const effectivePhoneCloseMinutes = Math.min(
                TimeUtil.parseShiftTimeToMinutes(DOMElements.shiftEnd.value),
                CONSTANTS.PHONE_CLOSE_MINUTES
            );
            
            const minutesUntilPhoneClose = effectivePhoneCloseMinutes - currentTimeMinutes;
            const minutesWorked = Math.max(1, currentTimeMinutes - shiftStartMinutes);

            // 1. Analyze Rounding State
            const minutesInHour = totalWorkTimeEOD % 60;
            const isRoundedUp = minutesInHour >= 30; // 30-59 mins rounds up to next hour

            // 2. Identify Next Grade
            const grades = [
                { name: 'Satisfactory', val: targetTicketGoal + gradeBoundaries.Satisfactory.min },
                { name: 'Excellent', val: targetTicketGoal + gradeBoundaries.Excellent.min },
                { name: 'Outstanding', val: targetTicketGoal + gradeBoundaries.Outstanding.min }
            ].sort((a,b) => a.val - b.val);
            const nextGrade = grades.find(g => g.val > currentTicketsSoFar);

            // 3. Get Professional Strategy
            const analysis = getStrategicAnalysis({
                workTimeMinutes: totalWorkTimeEOD,
                ticketsDone: currentTicketsSoFar,
                ticketsPerMinRate: currentTicketsSoFar / minutesWorked,
                minutesRemaining: minutesUntilPhoneClose,
                nextGrade: nextGrade,
                isRoundedUp: isRoundedUp
            });

            // 4. Render HTML
            let html = `<div style="display:flex; flex-direction:column; gap:8px;">`;

            // Style map matches existing CSS classes
            const styleMap = {
                'optimization': 'strategy-success', // Green 
                'opportunity': 'strategy-warn',     // Yellow 
                'conservation': 'strategy-danger',  // Red/Pink 
                'warn': 'strategy-danger',          // Red
                'info': 'strategy-normal',          // Grey (Using default)
                'success': 'strategy-success'       // Green
            };
            
            const cardClass = styleMap[analysis.type] || '';
            
            // Standardizing card look
            const borderStyle = cardClass ? '' : 'border-left: 3px solid var(--border-color);';

            html += `
                <div class="strategy-card ${cardClass}" style="margin:0; box-shadow: 0 1px 2px rgba(0,0,0,0.05); ${borderStyle}">
                    <div class="strategy-title">${analysis.title}</div>
                    <div class="strategy-text">${analysis.text}</div>
                </div>
            `;

            // Secondary Info for Context
            if (analysis.type === 'optimization' && nextGrade) {
                 html += `
                    <div style="font-size:0.8rem; color:var(--subtle-text); padding:0 4px;">
                        Next Objective: <strong>${nextGrade.name}</strong> (${nextGrade.val - currentTicketsSoFar} tickets remaining)
                    </div>
                `;
            }

            html += `</div>`;
            DOMElements.calcInfoContent.innerHTML = html;
        }

        // --- STANDARD CALCULATIONS ---

        function getScheduleInfo(now) {
            const startMinutes = TimeUtil.parseShiftTimeToMinutes(DOMElements.shiftStart.value);
            const endMinutes = TimeUtil.parseShiftTimeToMinutes(DOMElements.shiftEnd.value);
            const breakTimeMinutes = parseInt(DOMElements.breakTime.value, 10) || 0;
            
            // Validation
            if (endMinutes <= startMinutes) return { error: "Check Shift Times" };

            const totalShiftMinutes = endMinutes - startMinutes;
            const postBreak = totalShiftMinutes - breakTimeMinutes;
            const leeway = postBreak * CONSTANTS.LEEWAY_RATIO;
            const totalProductiveMinutes = postBreak - leeway;

            // Progress
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const minutesPassed = Math.max(0, Math.min(totalShiftMinutes, currentMinutes - startMinutes));
            
            // Ratio of productive time passed
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

            // Inputs
            const currentCallTimeSoFar = TimeUtil.parseTimeToMinutes(DOMElements.currentCallTime.value);
            const currentTicketsSoFar = parseInt(DOMElements.currentTickets.value) || 0;

            // Core Logic: Work Time = Available - Admin
            const totalWorkTimeEOD = totalProductiveMinutes - currentCallTimeSoFar;
            
            // Core Logic: Rounding
            const roundedWorkHours = Math.round(totalWorkTimeEOD / 60);
            const targetTicketGoal = roundedWorkHours * CONSTANTS.TICKETS_PER_HOUR_RATE;

            // Update Footer Stats
            DOMElements.totalWorkTimeEOD.innerText = TimeUtil.formatMinutesToHHMM_Signed(totalWorkTimeEOD);
            if (DOMElements.baseTargetDisplay) DOMElements.baseTargetDisplay.innerText = targetTicketGoal;

            // Render Grid
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

            // Render Strategy
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
            const current = TimeUtil.parseTimeToMinutes(DOMElements.currentCallTime.value);
            const add = parseInt(DOMElements.addCallTime.value, 10) || 0;
            if (add === 0) return;
            DOMElements.currentCallTime.value = TimeUtil.formatMinutesToHHMM(current + add);
            DOMElements.addCallTime.value = '';
            debouncedCalculateAndSave();
        });

        DOMElements.addCallTime.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') DOMElements.btnAddCallTime.click();
        });

        DOMElements.currentCallTime.addEventListener('blur', () => {
            const m = TimeUtil.parseTimeToMinutes(DOMElements.currentCallTime.value);
            DOMElements.currentCallTime.value = TimeUtil.formatMinutesToHHMM(m);
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

        setInterval(() => { if (document.visibilityState === 'visible') calculateDailyRatings(); }, 30000);

        updateInputsFromState();
        calculateDailyRatings();
        autoImportBookmarkletData();

        function autoImportBookmarkletData() {
            try {
                const mins = parseInt(localStorage.getItem(APP_CONFIG.IMPORT_KEY) || "0", 10);
                if (mins > 0) {
                    const cur = TimeUtil.parseTimeToMinutes(DOMElements.currentCallTime.value);
                    DOMElements.currentCallTime.value = TimeUtil.formatMinutesToHHMM(cur + mins);
                    localStorage.removeItem(APP_CONFIG.IMPORT_KEY);
                    debouncedCalculateAndSave();
                    SafeUI.showToast(`Imported ${mins} mins`);
                }
            } catch (e) { console.warn(e); }
        }
    })();
}
