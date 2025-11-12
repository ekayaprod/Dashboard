/**
 * bootstrap.js - Centralized dependency loader
 * This is the ONLY script tag needed in HTML files.
 * Version: 1.0.2
 */

(function() {
    'use strict';

    // Debug mode: Set to true to see detailed logging
    const DEBUG = true; // TODO: Set to false in production

    function debug(...args) {
        if (DEBUG) console.log('[Bootstrap Debug]', ...args);
    }
    
    // Configuration: Define load order and dependencies
    const CORE_SCRIPTS = [
        { 
            url: 'js/app-core.js', 
            exports: ['SafeUI', 'DOMHelpers', 'AppLifecycle', 'DataHelpers'],
            required: true
        },
        { 
            url: 'js/app-ui.js', 
            exports: ['UIPatterns', 'ListRenderer', 'SearchHelper', 'NotepadManager', 'QuickListManager', 'SharedSettingsModal'],
            required: true,
            dependsOn: ['SafeUI'] // Wait for app-core.js
        },
        { 
            url: 'js/app-data.js', 
            exports: ['BackupRestore', 'DataValidator', 'DataConverter', 'CsvManager'],
            required: true,
            dependsOn: ['SafeUI']
        }
    ];
    
    // Page-specific scripts (optional)
    const PAGE_SCRIPTS = {
        'mailto.html': [
            { url: 'js/msgreader.js', exports: ['MsgReader'], required: false }
        ]
    };
    
    // State tracking
    let loadedScripts = new Set();
    let failedScripts = new Set();
    
    /**
     * Escape HTML (inline, no dependencies)
     */
    function escapeHTML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Show detailed error banner (guaranteed to work even if body doesn't exist)
     */
    function showErrorBanner(title, details) {
        const banner = document.createElement('div');
        banner.id = 'bootstrap-error';
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            padding: 1rem;
            background-color: #fef2f2;
            color: #dc2626;
            border-bottom: 2px solid #fecaca;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 0.95rem;
            font-weight: 600;
            z-index: 999999;
            box-sizing: border-box;
            line-height: 1.5;
        `;
        banner.innerHTML = `
            <strong style="display: block; font-size: 1.1rem; margin-bottom: 0.5rem;">${escapeHTML(title)}</strong>
            <div style="font-weight: normal; font-size: 0.9rem;">${details}</div>
        `;
        
        // Robust insertion
        const insert = () => {
            if (document.body) {
                // Body exists, insert at top
                if (document.body.firstChild) {
                    document.body.insertBefore(banner, document.body.firstChild);
                } else {
                    document.body.appendChild(banner);
                }
            } else if (document.documentElement) {
                // Body doesn't exist, append to <html>
                document.documentElement.appendChild(banner);
            }
        };
        
        insert();
    }

    /**
     * Load a script (no export verification here - done later)
     */
    function loadScript(config) {
        return new Promise((resolve, reject) => {
            // Check dependencies first
            if (config.dependsOn) {
                const unmetDeps = config.dependsOn.filter(dep => typeof window[dep] === 'undefined');
                if (unmetDeps.length > 0) {
                    reject(new Error(`Unmet dependencies for ${config.url}: ${unmetDeps.join(', ')}`));
                    return;
                }
            }
            
            const script = document.createElement('script');
            script.src = config.url;
            script.async = false; // Maintain order
            
            script.onload = () => {
                console.log(`[Bootstrap] ✓ ${config.url} loaded`);
                loadedScripts.add(config.url);
                resolve(); // Trust that script loaded successfully
            };
            
            script.onerror = (event) => {
                const error = new Error(`Failed to load ${config.url} (404 or network error)`);
                console.error(`[Bootstrap]`, error);
                failedScripts.add(config.url);
                reject(error);
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * Main bootstrap function
     */
    async function bootstrap() {
        console.log('[Bootstrap] Starting dependency loader...');
        
        try {
            // Load core scripts in order (no verification yet)
            for (const config of CORE_SCRIPTS) {
                await loadScript(config);
            }
            
            // NOW verify all exports exist (after execution completes)
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
            
            // Load page-specific scripts (optional)
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            const pageScripts = PAGE_SCRIPTS[currentPage] || [];
            
            for (const config of pageScripts) {
                try {
                    await loadScript(config);
                    
                    // Verify page-specific exports
                    if (config.exports && config.exports.length > 0) {
                        const missing = config.exports.filter(exp => typeof window[exp] === 'undefined');
                        if (missing.length > 0 && config.required) {
                            throw new Error(`${config.url} missing exports: ${missing.join(', ')}`);
                        }
                    }
                } catch (err) {
                    if (config.required) {
                        throw err;
                    } else {
                        console.warn(`[Bootstrap] Optional script ${config.url} failed:`, err);
                    }
                }
            }
            
            console.log('[Bootstrap] ✓ All dependencies loaded successfully');
            
            // Dispatch ready event
            document.dispatchEvent(new CustomEvent('bootstrap:ready'));
            
        } catch (error) {
            console.error('[Bootstrap] ✗ Dependency loading failed:', error);
            
            const loadedList = Array.from(loadedScripts).map(url => url.split('/').pop()).join(', ') || 'None';
            const failedList = Array.from(failedScripts).map(url => url.split('/').pop()).join(', ') || 'Unknown';
            
            let errorDetails = `
                <strong>Error:</strong> ${escapeHTML(error.message)}<br><br>
                <strong>Loaded:</strong> ${escapeHTML(loadedList)}<br>
                <strong>Failed:</strong> ${escapeHTML(failedList)}<br><br>
                <strong>Troubleshooting:</strong><br>
                • Press F12 to open browser console for detailed errors<br>
                • Check that all .js files exist in /js/ folder<br>
                • Look for red errors in console indicating syntax issues<br>
            `;
            
            showErrorBanner('Application Failed to Load', errorDetails);
            throw error;
        }
    }
    
    // Start loading when DOM is ready
    // Note: Ensure this script is placed at the end of the <body> tag
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();