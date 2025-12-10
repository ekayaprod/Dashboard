/**
 * bootstrap.js - Centralized dependency loader
 * Loads JavaScript modules for the specific page.
 */

(function() {
    'use strict';

    // HTML Fragments injection is removed as per new Shell architecture.
    // Navbar is now handled by the Shell (index.html).
    const HTML_FRAGMENTS = [];

    const CORE_SCRIPTS = [
        { 
            url: 'js/app-core.js', 
            exports: ['UIUtils', 'SafeUI', 'DOMHelpers', 'AppLifecycle', 'DataHelpers'],
            required: true
        },
        { 
            url: 'js/app-ui.js', 
            exports: ['UIPatterns', 'ListRenderer', 'SearchHelper', 'NotepadManager', 'QuickListManager', 'SharedSettingsModal'],
            required: true,
            dependsOn: ['SafeUI']
        },
        { 
            url: 'js/app-data.js', 
            exports: ['BackupRestore', 'DataValidator', 'DataConverter', 'CsvManager'],
            required: true,
            dependsOn: ['SafeUI']
        }
    ];
    
    const PAGE_SCRIPTS = {
        'dashboard.html': [{ url: 'js/apps/dashboard.js', required: true }],
        'index.html': [], // Shell loads its own scripts manually
        'calculator.html': [{ url: 'js/apps/calculator.js', required: true }],
        'lookup.html': [{ url: 'js/apps/lookup.js', required: true }],
        'passwords.html': [{ url: 'js/apps/passwords.js', required: true }],
        'mailto.html': [{ url: 'js/apps/mailto.js', required: true, type: 'module' }]
    };
    
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

    // Deprecated: HTML loading removed
    async function loadHtmlFragment(config) {
        return Promise.resolve();
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
            if (config.type) {
                script.type = config.type;
            }
            
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
            // Load app-core first as it is a dependency for others
            const coreScript = CORE_SCRIPTS.find(c => c.url.includes('app-core.js'));
            if (coreScript) {
                await loadScript(coreScript);
            }

            // Load remaining core scripts in parallel
            const remainingCoreScripts = CORE_SCRIPTS.filter(c => !c.url.includes('app-core.js'));
            await Promise.all(remainingCoreScripts.map(loadScript));
            
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
            
            const currentPage = (window.location.pathname.split('/').pop() || 'index.html').split('?')[0];
            const pageScripts = PAGE_SCRIPTS[currentPage] || [];
            
            for (const config of pageScripts) {
                try { 
                    await loadScript(config); 
                } catch (err) { 
                    if (config.required) throw err; 
                }
            }
            
            console.log('[Bootstrap] ✓ System Ready');
            
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