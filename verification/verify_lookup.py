from playwright.sync_api import sync_playwright

def verify_lookup():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            page.goto("http://localhost:8080/lookup.html")

            # Wait for search input to ensure app loaded
            page.wait_for_selector("#search-input")

            # Check for settings button and aria-label
            settings_btn = page.locator("#btn-settings")
            aria_label = settings_btn.get_attribute("aria-label")

            print(f"Settings button aria-label: {aria_label}")

            if aria_label != "Settings":
                raise Exception(f"Expected aria-label 'Settings', got '{aria_label}'")

            # Take screenshot
            page.screenshot(path="verification/lookup_verification.png")
            print("Screenshot saved to verification/lookup_verification.png")

        except Exception as e:
            print(f"Verification failed: {e}")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_lookup()
