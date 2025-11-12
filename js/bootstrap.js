/**
 * bootstrap.js - Centralized dependency loader
 * Loads both JavaScript modules AND shared HTML components (Navbar).
 * Version: 1.1.2 (Fixed export verification)
 *
 * FIX v1.1.2: Added missing exports to verification lists:
 * - UIUtils (from app-core.js)
 * - APP_UI_VERSION (from app-ui.js)
 * - APP_DATA_VERSION (from app-data.js)
 */

(function() {
    'use strict';

    // Configuration: HTML Components to load
    // These are loaded in parallel with scripts but ensured to be in DOM before 'ready' fires.
    const HTML_FRAGMENTS = [
        { 
            url: 'navbar.html', 
            targetId: 'navbar-container', 
            required: false // If container exists, we load it. If not, we skip.
        }
    ];

    // Configuration: JS Scripts to load
    const CORE_SCRIPTS = [
        { 
            url: 'js/app-core.js', 
            exports: ['UIUtils', 'SafeUI', 'DOMHelpers', 'AppLifecycle', 'DataHelpers'],
            required: true
        },
        { 
            url: 'js/app-ui.js', 
            exports: ['UIPatterns', 'ListRenderer', 'SearchHelper', 'NotepadManager', 'QuickListManager', 'SharedSettingsModal', 'APP_UI_VERSION'],
            required: true,
            dependsOn: ['SafeUI']
        },
        { 
            url: 'js/app-data.js', 
            exports: ['BackupRestore', 'DataValidator', 'DataConverter', 'CsvManager', 'APP_DATA_VERSION'],
            required: true,
            dependsOn: ['SafeUI']
        }
    ];
    
    const PAGE_SCRIPTS = {
        'mailto.html': [
            { url: 'js/msgreader.js', exports: ['MsgReader'], required: false }
        ]
    };
    
    // State tracking
    let loadedScripts = new Set();
    let failedScripts = new Set();
    
    function escapeHTML(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function showErrorBanner(title, details) {
        const banner = document.createElement('div');
        banner.id = 'bootstrap-error';
        banner.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; padding: 1rem;
            background-color: #fef2f2; color: #dc2626; border-bottom: 2px solid #fecaca;
            font-family: system-ui, -apple-system, sans-serif; font-size: 0.95rem;
            font-weight: 600; z-index: 999999; box-sizing: border-box; line-height: 1.5;
        `;
        banner.innerHTML = `<strong style="display: block; font-size: 1.1rem; margin-bottom: 0.5rem;">${escapeHTML(title)}</strong><div style="font-weight: normal; font-size: 0.9rem;">${details}</div>`;
        
        if (document.body) {
            document.body.insertBefore(banner, document.body.firstChild);
        } else if (document.documentElement) {
            document.documentElement.appendChild(banner);
        }
    }

    /**
     * Fetches an HTML fragment and injects it into the target container.
     */
    async function loadHtmlFragment(config) {
        const container = document.getElementById(config.targetId);
        // If the page doesn't have the container (e.g. login page might not have navbar), skip it.
        if (!container) return;

        try {
            const response = await fetch(config.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            container.innerHTML = html;
            console.log(`[Bootstrap] ✓ HTML Loaded: ${config.url}`);
        } catch (error) {
            console.error(`[Bootstrap] ✗ Failed to load HTML ${config.url}:`, error);
            // We don't fail the whole app for a missing navbar, but we log it visibly
            container.innerHTML = `<div style="color:red; padding:10px; border:1px solid red; background:#fff;">Failed to load ${config.url}</div>`;
        }
    }

    function loadScript(config) {
        return new Promise((resolve, reject) => {
            if (config.dependsOn) {
                const unmetDeps = config.dependsOn.filter(dep => typeof window[dep] === 'undefined');
                if (unmetDeps.length > 0) {
                    reject(new Error(`Unmet dependencies for ${config.url}: ${unmetDeps.join(', ')}`));
                    return;
                }
            }
            
            const script = document.createElement('script');
            script.src = config.url;
            script.async = false;
            
            script.onload = () => {
                console.log(`[Bootstrap] ✓ Script Loaded: ${config.url}`);
                loadedScripts.add(config.url);
                resolve();
            };
            
            script.onerror = () => {
                const error = new Error(`Failed to load ${config.url} (404 or network error)`);
                console.error(`[Bootstrap]`, error);
                failedScripts.add(config.url);
                reject(error);
            };
            
            document.head.appendChild(script);
        });
    }
    
    async function bootstrap() {
        console.log('[Bootstrap] Starting dependency loader...');
        
        try {
            // 1. Start loading HTML fragments in parallel
            const htmlLoaders = HTML_FRAGMENTS.map(loadHtmlFragment);

            // 2. Load core scripts sequentially
            for (const config of CORE_SCRIPTS) {
                await loadScript(config);
            }
            
            // 3. Verify exports
            console.log('[Bootstrap] Verifying exports...');
            const allMissingExports = [];
            for (const config of CORE_SCRIPTS) {
                const missing = config.exports.filter(exp => typeof window[exp] === 'undefined');
                if (missing.length > 0) {
                    allMissingExports.push(`${config.url.split('/').pop()}: ${missing.join(', ')}`);
                }
            }
            if (allMissingExports.length > 0) {
                throw new Error(`Scripts loaded but missing exports:\n${allMissingExports.join('\n')}`);
            }
            
            // 4. Load page specific scripts
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            const pageScripts = PAGE_SCRIPTS[currentPage] || [];
            for (const config of pageScripts) {
                try { await loadScript(config); } 
                catch (err) { if (config.required) throw err; }
            }
            
            // 5. Wait for HTML to finish loading (if it hasn't already)
            await Promise.all(htmlLoaders);

            console.log('[Bootstrap] ✓ System Ready');
            
            // 6. Dispatch Ready Event
            document.dispatchEvent(new CustomEvent('bootstrap:ready'));
            
        } catch (error) {
            console.error('[Bootstrap] ✗ Dependency loading failed:', error);
            const loadedList = Array.from(loadedScripts).map(u => u.split('/').pop()).join(', ') || 'None';
            const failedList = Array.from(failedScripts).map(u => u.split('/').pop()).join(', ') || 'Unknown';
            
            let errorDetails = `
                <strong>Error:</strong> ${escapeHTML(error.message)}<br><br>
                <strong>Loaded:</strong> ${escapeHTML(loadedList)}<br>
                <strong>Failed:</strong> ${escapeHTML(failedList)}
            `;
            showErrorBanner('Application Failed to Load', errorDetails);
            throw error;
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();
