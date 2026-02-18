from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Log console messages
    page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Browser error: {err}"))

    print("Navigating to http://localhost:8000/lookup.html")
    # Load lookup.html via the server
    page.goto("http://localhost:8000/lookup.html")

    # Wait for the page to load and potentially show an empty state
    # The search input should be visible
    print("Waiting for search input")
    try:
        page.wait_for_selector("#search-input", timeout=5000)
    except Exception as e:
        print("Search input not found")
        page.screenshot(path="verification/lookup_failed.png")
        raise e

    # Add a new entry
    print("Filling search input with 'Test Entry'")
    page.fill("#search-input", "Test Entry")
    # Click "Create" button or similar. The empty state says "+ Create 'Test Entry'"

    # Wait for the "Create" button to appear in the empty state
    # getEmptyMessage is updated to show this button
    print("Waiting for Create button")
    create_btn = page.locator('[data-action="create-from-search"]')
    try:
        create_btn.wait_for(timeout=5000)
    except Exception as e:
        print("Create button not found")
        page.screenshot(path="verification/lookup_failed.png")
        raise e

    print("Clicking Create button")
    create_btn.click()

    # Wait for the edit form
    print("Waiting for edit form")
    try:
        page.wait_for_selector(".edit-form-li", timeout=5000)
    except Exception as e:
        print("Edit form not found")
        page.screenshot(path="verification/lookup_failed.png")
        raise e

    # Click Save
    print("Clicking Save")
    try:
        page.click(".btn-save", timeout=2000)
    except Exception as e:
         print("Save button not found or clickable")
         page.screenshot(path="verification/lookup_failed.png")
         raise e

    # Search again to see the item
    print("Searching again for 'Test Entry'")
    page.fill("#search-input", "Test Entry")

    # Wait for the new entry to appear in the list (read-only view)
    # It should have class "result-item" and contain "Test Entry"
    print("Waiting for result item")
    try:
        # Wait for the element to disappear (edit form) and new one to appear
        page.wait_for_selector(".result-item", timeout=5000)
    except Exception as e:
        print("Result item not found")
        page.screenshot(path="verification/lookup_failed.png")
        raise e

    # Take a screenshot
    print("Taking screenshot")
    page.screenshot(path="verification/lookup_verified.png")

    print("Verification complete. Screenshot saved to verification/lookup_verified.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
