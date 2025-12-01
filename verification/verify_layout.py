from playwright.sync_api import sync_playwright

def verify_calculator_layout():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a mobile/sidebar-like viewport
        context = browser.new_context(viewport={'width': 350, 'height': 600})
        page = context.new_page()

        # Navigate to the calculator page
        page.goto("http://localhost:8080/calculator.html")

        # Wait for initialization (some text to appear)
        page.wait_for_selector("text=Schedule", timeout=5000)

        # Expand all accordions if they aren't already (they should be by default)
        # But let's check visibility of content

        # Take a screenshot of the initial loaded state
        page.screenshot(path="verification/calculator_sidebar.png", full_page=True)

        # Hover over a target card to check tooltip if possible (hard to capture in screenshot but good to try)
        # Note: Playwright hover might not trigger the CSS tooltip in a static screenshot unless we wait or force state.

        print("Screenshot saved to verification/calculator_sidebar.png")
        browser.close()

if __name__ == "__main__":
    verify_calculator_layout()
