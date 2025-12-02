
from playwright.sync_api import sync_playwright
import os

def run():
    # Start a simple HTTP server to serve the current directory
    import subprocess
    import time

    # Run python http server in background
    server = subprocess.Popen(['python3', '-m', 'http.server', '8000'], cwd=os.getcwd())
    time.sleep(2) # Give it a moment to start

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            # Go to calculator page
            page.goto('http://localhost:8000/calculator.html')

            # Wait for app to load (checking for schedule header)
            page.wait_for_selector('#schedule-header')

            # Expand schedule and set some values to trigger target calculation
            # Actually default state should have some targets.
            # But let's set current tickets to 5 to see progress

            page.fill('#currentTickets', '5')
            # Trigger input event manually if needed, but fill usually does it
            # The app uses 'input' event listener.

            # Force a recalculation just in case by blurring or similar
            page.evaluate("document.getElementById('currentTickets').dispatchEvent(new Event('input'))")

            # Wait a moment for debounce
            page.wait_for_timeout(1000)

            # Take screenshot of the targets section
            # We want to see the badges and the text inside them

            # Scroll to targets
            target_grid = page.locator('#targets-grid')
            target_grid.scroll_into_view_if_needed()

            page.screenshot(path='verification/calculator_badges.png', full_page=True)

    finally:
        server.terminate()

if __name__ == '__main__':
    run()
