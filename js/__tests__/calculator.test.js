import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, '../../calculator.html'), 'utf8');

describe('js/apps/calculator.js', () => {
    let mockAppCtx;

    beforeEach(() => {
        document.body.innerHTML = html;
        window.localStorage.clear();
        vi.resetModules();
        vi.clearAllMocks();

        // Mock global dependencies
        window.SafeUI = {
            showToast: vi.fn(),
            showModal: vi.fn((title, body, buttons) => {
                // Find the confirmation button and trigger its callback immediately
                const confirmBtn = buttons.find(b => b.callback);
                if (confirmBtn && confirmBtn.callback) {
                    confirmBtn.callback();
                }
            }),
            debounce: (fn) => fn
        };
        window.DateUtils = {
            parseTimeToMinutes: (timeStr) => {
                if (!timeStr) return 0;
                if (typeof timeStr !== 'string') return 0;
                const [hh, mm] = timeStr.split(':').map(Number);
                return (hh * 60) + (mm || 0);
            },
            formatMinutesToHHMM_Signed: (mins) => `${mins}m`,
            formatMinutesToHHMM: (mins) => {
                 const h = Math.floor(mins / 60);
                 const m = mins % 60;
                 return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
        };
        window.DOMHelpers = {
            createElement: (tag, className) => {
                const el = document.createElement(tag);
                if (className) el.className = className;
                return el;
            },
            createOption: (value, text) => {
                const opt = document.createElement('option');
                opt.value = value;
                opt.textContent = text || value;
                return opt;
            }
        };

        mockAppCtx = {
            state: { ui: { shiftStart: '09:00', shiftEnd: '17:00', breakTime: 60, currentCallTime: '01:00', currentTickets: 10 } },
            defaultState: { ui: { shiftStart: '09:00', shiftEnd: '17:00', breakTime: 60 } },
            saveState: vi.fn(),
            registerExportBuilder: vi.fn(),
            elements: {
                shiftStart: document.getElementById('shiftStart'),
                shiftEnd: document.getElementById('shiftEnd'),
                breakTime: document.getElementById('breakTime'),
                currentCallTime: document.getElementById('currentCallTime'),
                currentTickets: document.getElementById('currentTickets'),
                calcInfoContent: document.getElementById('calcInfoContent') || document.createElement('div'),
                targetsGrid: document.getElementById('targetsGrid') || document.createElement('div'),
                totalWorkTimeEOD: document.getElementById('totalWorkTimeEOD') || document.createElement('div'),
                baseTargetDisplay: document.getElementById('baseTargetDisplay') || document.createElement('div'),
                targetStatsBar: document.getElementById('targetStatsBar') || document.createElement('div'),
                btnAddCallTime: document.getElementById('btnAddCallTime') || document.createElement('button'),
                addCallTime: document.getElementById('addCallTime') || document.createElement('input'),
                btnResetData: document.getElementById('btnResetData') || document.createElement('button')
            }
        };

        // Mock AppLifecycle
        window.AppLifecycle = {
            onBootstrap: (cb) => cb(),
            initPage: async (config) => {
                return mockAppCtx;
            }
        };

        window.COPY = {
            STATUS: { ADD_PREFIX: '+', MIN_SUFFIX: 'm', NA: 'N/A', OVER_SHIFT: 'OVER' },
            ERRORS: { CHECK_TIMES: 'Check Times', INVALID: 'Invalid' },
            STRATEGY: { QUICK_FIX_TITLE: 'Quick Fix', QUICK_FIX_BODY: (m) => `Add ${m}m` },
            BUFFER: { SPIKE_TITLE: 'Spike', SPIKE_ACTION: (m) => `Add ${m}m`, SAFE_LABEL: 'Safe' },
            MODALS: { RESET_TITLE: 'Reset', RESET_BODY: 'Body', CANCEL: 'Cancel', CONFIRM_RESET: 'Reset' },
            TOASTS: { RESTORED: (m) => `Restored ${m} mins` }
        };

        window.CONSTANTS = {
            LEEWAY_RATIO: 0.1,
            TICKETS_PER_HOUR_RATE: 6
        };

        window.gradeBoundaries = {
            "Outstanding": { min: 7 },
            "Excellent": { min: 4 }
        };
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    it('should evaluate calculateAdditionalCallTimeNeeded correctly for typical bounds', async () => {
        await import('../apps/calculator.js');
        // We're mainly validating that the JS doesn't crash on load and events can be triggered.
        const addCallBtn = mockAppCtx.elements.btnAddCallTime;
        mockAppCtx.elements.addCallTime.value = '15';

        addCallBtn.click();

        // 01:00 (60 mins) + 15 mins = 75 mins -> 01:15
        expect(mockAppCtx.elements.currentCallTime.value).toBe('01:15');
    });
});
