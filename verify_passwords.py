
from playwright.sync_api import Page, expect, sync_playwright
import time
import re

def test_temporary_password_generation(page: Page):
    # 1. Arrange: Go to the passwords page.
    page.goto("http://localhost:8080/passwords.html")

    # Wait for the page to load and bootstrap
    page.wait_for_selector("#btn-quick-generate-temp")

    # 2. Act: Click the "Generate Temporary Password" button.
    temp_btn = page.locator("#btn-quick-generate-temp")
    temp_btn.click()

    # 3. Assert: Check the results.
    results_list = page.locator("#results-list")
    expect(results_list).not_to_be_empty()

    # Get the first generated password
    password_item = results_list.locator(".result-item span").first
    password_text = password_item.text_content()
    print(f"Generated Password: {password_text}")

    # Verify length is at least 12
    assert len(password_text) >= 12, f"Password length {len(password_text)} is less than 12"

    # Verify structure: 1 word + digits. Digits can be start or end.
    # Check for digit block
    digit_match = re.search(r'\d+', password_text)
    assert digit_match, "Password should contain digits"

    # Remove digits to get the word part
    word_part = re.sub(r'\d+', '', password_text)

    # The word part should be alphabetic (ignoring potential symbols if any, but settings said 0 symbols)
    assert word_part.isalpha(), f"Word part '{word_part}' should be alphabetic"

    # Check if the word length is reasonable (around 11)
    assert len(word_part) >= 8, f"Word part '{word_part}' seems too short for a LongWord"

    print(f"Verified structure: Word='{word_part}', Digits='{digit_match.group()}'")

    # 4. Screenshot
    page.screenshot(path="verification_temp_pass.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_temporary_password_generation(page)
        finally:
            browser.close()
