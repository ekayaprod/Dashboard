from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Get absolute path to index.html
    cwd = os.getcwd()
    file_path = f"file://{cwd}/index.html"

    print(f"Navigating to {file_path}")
    page.goto(file_path)

    # Wait for dashboard specific element to ensure bootstrap finished
    try:
        page.wait_for_selector("#shortcuts-container", timeout=5000)
        print("Dashboard loaded successfully.")
    except:
        print("Dashboard failed to load or timed out.")

    # Take screenshot
    page.screenshot(path="verification/dashboard_load.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
