/**
 * bootstrap.js - Centralized dependency loader
 * This is the ONLY script tag needed in HTML files.
 * Version: 1.0.1
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
     * Escape HTML to prevent XSS in error messages
     */
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Show detailed error banner (inline, always available)
     */
    function showErrorBanner(title, details) {
        // Create banner element
        const banner = document.createElement('div');
        banner.id = 'bootstrap-error';
        banner.className = 'app-startup-banner'; // Use existing CSS class
        banner.innerHTML = `
            <strong>${escapeHTML(title)}</strong>
            <p style="margin: 0.5rem 0 0 0; font-weight: normal;">${details}</p>
        `;
        
        // Ensure it's visible even if CSS fails to load
        banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            padding: 1rem;
            background-color: #fef2f2;
            color: #dc2626;
            border-bottom: 2px solid #fecaca;
            font-family: sans-serif;
            font-size: 1rem;
            font-weight: 600;
            z-index: 10000;
            box-sizing: border-box;
        `;
        
        // Insert at the very top of the page
        if (document.body) {
            document.body.insertBefore(banner, document.body.firstChild);
        } else {
            // Body doesn't exist yet, wait for it
            document.addEventListener('DOMContentLoaded', () => {
                document.body.insertBefore(banner, document.body.firstChild);
            });
        }
    }

    /**
     * Load a script and wait for execution
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
                debug(`Script onload fired: ${config.url}`);
                console.log(`[Bootstrap] Script downloaded: ${config.url}`);
                
                // Wait a tick for script to execute, then verify exports
                setTimeout(() => {
                    debug(`Checking exports for ${config.url}:`, config.exports);
                    debug(`Window objects:`, config.exports.map(exp => `${exp}: ${typeof window[exp]}`));
                    
                    const missingExports = config.exports.filter(exp => typeof window[exp] === 'undefined');
                    
                    if (missingExports.length > 0) {
                        const error = new Error(`Script loaded but missing exports: ${missingExports.join(', ')}`);
                        console.error(`[Bootstrap] ${config.url} failed verification:`, error);
                        failedScripts.add(config.url);
                        reject(error);
                    } else {
                        console.log(`[Bootstrap] ✓ ${config.url} loaded and verified`);
                        loadedScripts.add(config.url);
                        resolve();
                    }
                }, 50); // 50ms delay to allow script execution
            };
            
            script.onerror = (event) => {
                const error = new Error(`Failed to load ${config.url} (network error or 404)`);
                console.error(`[Bootstrap] ${config.url} network failure:`, error);
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
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        debug('Starting bootstrap with config:', CORE_SCRIPTS);
        debug('Current page:', currentPage);
        
        try {
            // Load core scripts in order
            for (const config of CORE_SCRIPTS) {
                await loadScript(config);
            }
            
            // Load page-specific scripts (optional)
            const pageScripts = PAGE_SCRIPTS[currentPage] || [];
            
            for (const config of pageScripts) {
                try {
                    await loadScript(config);
                } catch (err) {
                    if (config.required) {
                        throw err; // Fail fast if required
                    } else {
                        console.warn(`[Bootstrap] Optional script ${config.url} failed to load:`, err);
                    }
                }
            }
            
            console.log('[Bootstrap] ✓ All dependencies loaded successfully');
            
            // Dispatch ready event
            document.dispatchEvent(new CustomEvent('bootstrap:ready'));
            
        } catch (error) {
            console.error('[Bootstrap] ✗ Dependency loading failed:', error);
            
            // Build detailed error report
            const loadedList = Array.from(loadedScripts).map(url => url.split('/').pop()).join(', ') || 'None';
            const failedList = Array.from(failedScripts).map(url => url.split('/').pop()).join(', ') || 'None';
            
            let errorDetails = `
                <strong>Error:</strong> ${error.message}<br><br>
                <strong>Successfully Loaded:</strong> ${loadedList}<br>
                <strong>Failed to Load:</strong> ${failedList}<br><br>
            `;
            
            // Add specific troubleshooting steps
            if (failedScripts.size > 0) {
                errorDetails += `
                    <strong>Troubleshooting:</strong><br>
                    • Check browser console (F12) for detailed errors<br>
                    • Ensure all .js files exist in the /js/ folder<br>
                    • Check for JavaScript syntax errors in failed scripts<br>
                `;
            } else if (error.message.includes('missing exports')) {
                errorDetails += `
                    <strong>Troubleshooting:</strong><br>
                    • A script loaded but didn't expose expected functions<br>
                    • Check browser console for which exports are missing<br>
                    • Verify the script file isn't corrupted or empty<br>
                `;
            }
            
            showErrorBanner('Application Failed to Load', errorDetails);
            
            // Also throw so it appears in console
            throw error;
        }
    }
    
    // Start loading when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();