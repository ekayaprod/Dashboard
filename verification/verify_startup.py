
from playwright.sync_api import sync_playwright
import os

def verify_page(page, url, name):
    print(f"Verifying {name} at {url}...")
    page.goto(url)
    # Wait for bootstrap to finish (it dispatches bootstrap:ready)
    # Or wait for specific elements to appear
    try:
        page.wait_for_function("() => window.SafeUI && window.SafeUI.isReady", timeout=5000)
        print(f"{name}: SafeUI is ready")
    except Exception as e:
        print(f"{name}: Timeout waiting for SafeUI: {e}")

    # Take a screenshot
    page.screenshot(path=f"verification/{name}.png")
    print(f"{name}: Screenshot saved")

def main():
    # Ensure verification directory exists
    if not os.path.exists('verification'):
        os.makedirs('verification')

    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Since we are running from file://, we need absolute paths
        cwd = os.getcwd()
        base_url = f"file://{cwd}/"

        # 1. Verify Dashboard
        verify_page(page, base_url + "index.html", "dashboard")

        # 2. Verify Calculator
        verify_page(page, base_url + "calculator.html", "calculator")

        # 3. Verify Lookup
        verify_page(page, base_url + "lookup.html", "lookup")

        # 4. Verify Passwords
        verify_page(page, base_url + "passwords.html", "passwords")

        # 5. Verify Mailto
        # Mailto uses ES modules which might be blocked by CORS on file:// protocol in some environments.
        # However, modern Playwright/Chromium might handle it or we might see an error.
        # Let's try.
        try:
            verify_page(page, base_url + "mailto.html", "mailto")
        except Exception as e:
            print(f"Mailto verification failed (likely CORS): {e}")

        browser.close()

if __name__ == "__main__":
    main()
