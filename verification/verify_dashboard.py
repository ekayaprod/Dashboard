from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8080/dashboard.html")

    # Wait for the "Applications" header to be visible
    try:
        page.wait_for_selector("#app-section-header", state="visible", timeout=5000)
        print("Applications header visible.")

        # Check if any error banner is visible
        if page.locator("#app-startup-error").is_visible():
            print("Error banner detected!")
            error_text = page.locator("#app-startup-error").inner_text()
            print(f"Error details: {error_text}")
        else:
            print("No startup error detected.")

        # Check if bootstrap script loaded
        # We can check if window.SafeUI is defined, as it comes from app-core.js which is loaded via manifest
        is_safeui_defined = page.evaluate("typeof window.SafeUI !== 'undefined'")
        print(f"SafeUI defined: {is_safeui_defined}")

    except Exception as e:
        print(f"Verification failed: {e}")

    page.screenshot(path="verification/dashboard.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
