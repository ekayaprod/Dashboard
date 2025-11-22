from playwright.sync_api import sync_playwright
import os

def verify_styles():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Verify Index Page
        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector(".app-container")
        page.screenshot(path="verification/index_styles.png")

        # Verify MailTo Page
        page.goto("http://localhost:8080/mailto.html")
        page.wait_for_selector(".accordion")
        page.screenshot(path="verification/mailto_styles.png")

        # Verify Calculator Page
        page.goto("http://localhost:8080/calculator.html")
        page.wait_for_selector(".accordion")
        page.screenshot(path="verification/calculator_styles.png")

        browser.close()

if __name__ == "__main__":
    verify_styles()
