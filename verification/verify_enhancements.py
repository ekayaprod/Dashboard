from playwright.sync_api import sync_playwright, expect
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Enable Time Travel
    page.add_init_script("window.APP_TIME_TRAVEL_DATE = '2023-10-27T10:00:00'")

    page.goto("http://localhost:8000/calculator.html")

    # Wait for app to initialize
    page.wait_for_selector("body", state="attached")

    # Ensure accordion "Schedule" is open
    try:
        if not page.is_visible("#shiftStart"):
            print("Schedule accordion content hidden, clicking header...")
            page.click("#schedule-header")
            page.wait_for_selector("#shiftStart", state="visible")
    except Exception as e:
        print(f"Error handling Schedule accordion: {e}")

    # Wait for dropdown options to populate
    page.wait_for_function("document.getElementById('shiftStart').options.length > 0")

    # 1. Setup Scenario for "Easier Path"
    page.select_option("#shiftStart", "08:00")
    page.select_option("#shiftEnd", "12:30")

    # Ensure "Progress" accordion is open
    # Note: Accordions might have generic headers.
    # The "Progress" section has <h2>2. Progress</h2>
    # We should click the header for section 2 if #currentTickets is not visible.

    try:
        if not page.is_visible("#currentTickets"):
            print("Progress accordion content hidden, clicking header...")
            # Locator for the header containing "2. Progress"
            page.click("div.accordion-header:has-text('2. Progress')")
            page.wait_for_selector("#currentTickets", state="visible")
    except Exception as e:
        print(f"Error handling Progress accordion: {e}")

    # Use fill for inputs with CORRECT IDs
    page.fill("#currentTickets", "24")
    page.fill("#currentCallTime", "00:00")

    # Trigger calculation
    page.click("body")
    page.wait_for_timeout(500) # Short wait for calculation UI update

    # Take screenshot
    page.screenshot(path="verification/calculator_enhancements.png")

    # Check for the badge content
    try:
        expect(page.locator("text=Easier Path")).to_be_visible()
        print("PASS: Easier Path badge visible")
    except:
        print("FAIL: Easier Path badge missing")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
