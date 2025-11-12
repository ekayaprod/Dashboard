/**
 * bootstrap.js - Centralized dependency loader
 * This is the ONLY script tag needed in HTML files.
 * Version: 1.0.0
 */

(function() {
    'use strict';
    
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
     * Load a script and verify its exports
     */
    function loadScript(config) {
        return new Promise((resolve, reject) => {
            // Check dependencies first
            if (config.dependsOn) {
                const unmetDeps = config.dependsOn.filter(dep => typeof window[dep] === 'undefined');
                if (unmetDeps.length > 0) {
                    reject(new Error(`Unmet dependencies: ${unmetDeps.join(', ')}`));
                    return;
                }
            }
            
            const script = document.createElement('script');
            script.src = config.url;
            script.async = false; // Maintain order
            
            script.onload = () => {
                // Verify exports
                const missingExports = config.exports.filter(exp => typeof window[exp] === 'undefined');
                
                if (missingExports.length > 0) {
                    const error = new Error(`Script loaded but missing exports: ${missingExports.join(', ')}`);
                    console.error(`[Bootstrap] ${config.url} failed verification:`, error);
                    failedScripts.add(config.url);
                    reject(error);
                } else {
                    console.log(`[Bootstrap] ✓ ${config.url} loaded successfully`);
                    loadedScripts.add(config.url);
                    resolve();
                }
            };
            
            script.onerror = (event) => {
                const error = new Error(`Failed to load ${config.url}`);
                console.error(`[Bootstrap] ${config.url} failed to load:`, error);
                failedScripts.add(config.url);
                reject(error);
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * Show detailed error banner
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
            font-family: sans-serif;
            z-index: 10000;
        `;
        banner.innerHTML = `
            <strong>${title}</strong>
            <p style="margin: 0.5rem 0 0 0; font-weight: normal;">${details}</p>
        `;
        document.body.prepend(banner);
    }
    
    /**
     * Main bootstrap function
     */
    async function bootstrap() {
        console.log('[Bootstrap] Starting dependency loader...');
        
        try {
            // Load core scripts in order
            for (const config of CORE_SCRIPTS) {
                await loadScript(config);
            }
            
            // Load page-specific scripts (optional)
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
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
            
            // Show detailed error
            const loadedList = Array.from(loadedScripts).join(', ') || 'None';
            const failedList = Array.from(failedScripts).join(', ') || 'None';
            
            showErrorBanner(
                'Application Failed to Load',
                `
                    <strong>Error:</strong> ${error.message}<br>
                    <strong>Loaded:</strong> ${loadedList}<br>
                    <strong>Failed:</strong> ${failedList}<br>
                    <br>
                    Please check the browser console for details.
                `
            );
            
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