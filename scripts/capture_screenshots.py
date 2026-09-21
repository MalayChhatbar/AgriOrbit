"""Smoke-verify the running AgriOrbit dev stack and capture page screenshots."""
import pathlib
import sys

from playwright.sync_api import sync_playwright

OUT = pathlib.Path(__file__).resolve().parent.parent / "docs" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)

PAGES = [
    ("home", "http://localhost:5173/", 4000),
    ("advisory", "http://localhost:5173/advisory", 6000),
    ("chat", "http://localhost:5173/chat", 3000),
    ("about", "http://localhost:5173/about", 3000),
]

console_errors: list[str] = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(str(e)))
    for name, url, settle_ms in PAGES:
        page.goto(url, wait_until="networkidle")
        if name == "advisory":
            page.wait_for_selector("text=16-day rainfall forecast", timeout=60000)
            page.wait_for_timeout(3500)  # charts animate in
        else:
            page.wait_for_timeout(settle_ms)
        page.screenshot(path=str(OUT / f"{name}.png"), full_page=False)
        print(f"saved {name}.png  (title: {page.title()})")
    browser.close()

if console_errors:
    print("CONSOLE ERRORS:")
    for e in console_errors[:15]:
        print("  -", e[:300])
    sys.exit(1)
print("NO CONSOLE ERRORS")
