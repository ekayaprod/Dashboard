const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // 1. Open the lookup page via local http-server
    await page.goto(`http://localhost:8080/lookup.html`);

    // Wait for the app to initialize
    await page.waitForTimeout(2000);

    // 2. Initial empty state
    await page.screenshot({ path: 'verification/initial_empty_state.png' });

    // 3. Search for a non-existent term to see the "no entries found" empty state
    await page.fill('#search-input', 'nonexistentterm');
    await page.waitForTimeout(1000); // Wait for debounce and render
    await page.screenshot({ path: 'verification/no_results_empty_state.png' });

    // 4. Open Settings to see the custom searches empty state
    await page.click('#btn-settings');
    await page.waitForTimeout(1000); // Wait for modal to open
    await page.screenshot({ path: 'verification/settings_empty_state.png' });

    await browser.close();
})();
