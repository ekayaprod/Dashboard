
from playwright.sync_api import Page, expect, sync_playwright

def test_seasonal_tooltip_and_generation(page: Page):
    # 1. Arrange: Go to the passwords page.
    page.goto("http://localhost:8080/passwords.html")

    # Wait for the header to be visible (always visible)
    page.wait_for_selector("#custom-gen-header")

    # Check if the accordion content is visible. It might be hidden if collapsed.
    # We should expand it first.
    header = page.locator("#custom-gen-header")
    is_expanded = header.get_attribute("aria-expanded")

    if is_expanded == "false" or is_expanded is None:
        print("Accordion is collapsed. Expanding...")
        # Use dispatch_event because sometimes click might be intercepted or need to be exact
        header.click()
        # Wait for the content to become visible
        page.wait_for_selector("#custom-generator-config", state="visible")
    else:
        # If already expanded, just wait for content
        page.wait_for_selector("#custom-generator-config", state="visible")

    # Now the button should be visible/clickable
    # Wait specifically for the info button to be visible
    info_btn = page.locator("#seasonal-info-btn")
    info_btn.wait_for(state="visible")
    info_btn.click()

    # 3. Assert: Check the tooltip content
    modal_content = page.locator(".modal-content")
    expect(modal_content).to_be_visible()
    expect(modal_content).to_contain_text("Months 12, 1, 2 (Dec-Feb)")
    expect(modal_content).to_contain_text("Months 3, 4, 5 (Mar-May)")
    expect(modal_content).to_contain_text("Months 6, 7, 8 (Jun-Aug)")
    expect(modal_content).to_contain_text("Months 9, 10, 11 (Sep-Nov)")

    # Close modal
    page.locator("button", has_text="OK").click()

    # 4. Act: Generate passwords using a specific season to verify wordbank loading
    # Select 'Winter'
    page.select_option("#seasonal-bank-select", "winter")
    # Generate
    page.click("#btn-generate")

    results_list = page.locator("#results-list")
    expect(results_list).not_to_be_empty()

    # 5. Screenshot
    page.screenshot(path="verification_seasonal.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_seasonal_tooltip_and_generation(page)
        finally:
            browser.close()
