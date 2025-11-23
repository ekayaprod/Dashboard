from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Get absolute path to verification_test.html
    cwd = os.getcwd()
    file_path = f"file://{cwd}/verification_test.html"

    print(f"Navigating to {file_path}")
    page.goto(file_path)

    # Wait for output
    page.wait_for_selector("#test-output div")

    # Take screenshot
    page.screenshot(path="verification/test_result.png")

    # Get text content to verify
    content = page.locator("#test-output").text_content()
    print("Output Content:", content)

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
