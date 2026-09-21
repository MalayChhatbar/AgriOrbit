"""E2E probe: advisory page with new feature cards + growth tracker interaction."""
from playwright.sync_api import sync_playwright

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1440, "height": 1000})
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto("http://localhost:5173/advisory", wait_until="networkidle")
    pg.wait_for_selector("text=16-day rainfall forecast", timeout=60000)
    pg.wait_for_selector("text=Operations planner", timeout=30000)
    pg.fill('input[type="date"]', "2026-07-01")
    pg.wait_for_selector("text=Grain filling", timeout=60000)
    pg.wait_for_timeout(2500)
    for probe in [
        "Pest & disease outlook",
        "Growth tracker (GDD)",
        "Spraying / fertigation",
        "This season vs 30-year normal",
        "Operations planner",
    ]:
        print(probe, "->", "FOUND" if probe in pg.content() else "MISSING")
    pg.screenshot(path="docs/screenshots/advisory_full.png", full_page=True)
    print("full-page saved")
    b.close()
print("ERRORS:", errors if errors else "none")
