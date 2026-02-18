from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Take screenshots
        for app in ['lookup', 'dashboard', 'passwords', 'calculator', 'mailto']:
            try:
                page.goto(f"file://{os.path.abspath(f'{app}.html')}")
                page.wait_for_timeout(500)
                page.screenshot(path=f"verification/{app}.png")
                print(f"Screenshot taken for {app}")
            except Exception as e:
                print(f"Error screenshotting {app}: {e}")

        browser.close()

if __name__ == "__main__":
    run()
