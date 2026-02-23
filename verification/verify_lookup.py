import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:8080/lookup.html")

        # 1. Initial State
        time.sleep(1) # Wait for init
        page.screenshot(path="verification/lookup_initial.png")
        print("Initial screenshot taken")

        # 2. Type "test"
        page.fill("#search-input", "test")

        # Capture loading state immediately? It might be too fast.
        # But let's try to capture empty state first.
        try:
            page.wait_for_selector(".empty-search-state", timeout=5000)
            page.screenshot(path="verification/lookup_empty.png")
            print("Empty state screenshot taken")
        except Exception as e:
            print(f"Empty state not found: {e}")

        # 3. Edit Mode
        # Clear search first
        page.click("#btn-clear-search")
        time.sleep(0.5)

        page.click("#btn-edit-mode")
        time.sleep(0.5)
        page.screenshot(path="verification/lookup_edit_mode.png")
        print("Edit mode screenshot taken")

        browser.close()

if __name__ == "__main__":
    run()
