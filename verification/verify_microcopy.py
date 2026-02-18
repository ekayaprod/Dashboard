from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # 1. Verify Lookup
        print("--- Lookup ---")
        try:
            page.goto(f"file://{os.path.abspath('lookup.html')}")
            page.wait_for_timeout(500)
            search_input = page.locator('#search-input')
            print(f"Placeholder: '{search_input.get_attribute('placeholder')}'")
            edit_btn = page.locator('#btn-edit-mode')
            print(f"Edit Button: '{edit_btn.text_content()}'")
            print(f"Edit Aria: '{edit_btn.get_attribute('aria-label')}'")
            settings_btn = page.locator('#btn-settings')
            print(f"Settings Aria: '{settings_btn.get_attribute('aria-label')}'")
        except Exception as e:
            print(f"Lookup Error: {e}")

        # 2. Verify Dashboard
        print("\n--- Dashboard ---")
        try:
            page.goto(f"file://{os.path.abspath('dashboard.html')}")
            page.wait_for_timeout(500)
            notepad = page.locator('#notepad-editor')
            print(f"Notepad Placeholder: '{notepad.get_attribute('placeholder')}'")
            app_empty = page.locator('#app-empty-state')
            if app_empty.is_visible():
                print(f"Empty State: '{app_empty.text_content().strip()}'")
        except Exception as e:
            print(f"Dashboard Error: {e}")

        # 3. Verify Passwords
        print("\n--- Passwords ---")
        try:
            page.goto(f"file://{os.path.abspath('passwords.html')}")
            page.wait_for_timeout(500)
            temp_btn = page.locator('#btn-quick-generate-temp')
            print(f"Temp Button: '{temp_btn.text_content().strip()}'")

            # Check for error or empty state
            error = page.locator('#app-startup-error')
            if error.is_visible():
                print(f"Startup Error: {error.text_content().strip()}")

            # Try to find empty state (static or dynamic)
            static_empty = page.locator('.empty-state-message')
            dynamic_empty = page.locator('.empty-state-text')

            if dynamic_empty.is_visible():
                print(f"Dynamic Empty State: '{dynamic_empty.text_content().strip()}'")
            elif static_empty.is_visible():
                print(f"Static Empty State: '{static_empty.text_content().strip()}'")
            else:
                print("No empty state visible.")

        except Exception as e:
            print(f"Passwords Error: {e}")

        # 4. Verify Calculator
        print("\n--- Calculator ---")
        try:
            page.goto(f"file://{os.path.abspath('calculator.html')}")
            page.wait_for_timeout(500)
            footer = page.locator('.subtle-footer-stats')
            print(f"Footer: '{footer.text_content().strip()}'")
            reset_btn = page.locator('#btnResetData')
            print(f"Reset Button: '{reset_btn.text_content().strip()}'")
        except Exception as e:
            print(f"Calculator Error: {e}")


        # 5. Verify Mailto
        print("\n--- Mailto ---")
        try:
            page.goto(f"file://{os.path.abspath('mailto.html')}")
            page.wait_for_timeout(500)
            upload_label = page.locator('#upload-wrapper strong')
            print(f"Upload Label: '{upload_label.text_content().strip()}'")
            body_input = page.locator('#result-body')
            print(f"Body Placeholder: '{body_input.get_attribute('placeholder')}'")
            settings_btn = page.locator('#btn-settings')
            print(f"Settings Aria: '{settings_btn.get_attribute('aria-label')}'")
            new_folder_btn = page.locator('#btn-new-folder')
            print(f"New Folder Aria: '{new_folder_btn.get_attribute('aria-label')}'")
        except Exception as e:
            print(f"Mailto Error: {e}")

        browser.close()

if __name__ == "__main__":
    run()
