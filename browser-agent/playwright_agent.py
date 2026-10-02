#!/usr/bin/env python3
"""
AIRA — Playwright Browser Automation Agent
Supports Chrome, Edge, and Firefox with DOM/accessibility-first selectors:
- open_browser(provider)
- open_url(url)
- read_page() -> extracts title, headings, buttons, links, inputs, forms
- search_web(query, engine)
- click / type / scroll / new_tab / close_tab / go_back / go_forward
"""

import asyncio
import json
from typing import Any, Dict


class AiraPlaywrightBrowserAgent:
    def __init__(self, browser_provider: str = "chrome"):
        self.browser_provider = browser_provider
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None

    async def ensure_started(self):
        if self.page is not None:
            return
        from playwright.async_api import async_playwright

        self.playwright = await async_playwright().start()
        if self.browser_provider == "firefox":
            self.browser = await self.playwright.firefox.launch(headless=False)
        elif self.browser_provider == "edge":
            self.browser = await self.playwright.chromium.launch(channel="msedge", headless=False)
        else:
            self.browser = await self.playwright.chromium.launch(channel="chrome", headless=False)

        self.context = await self.browser.new_context()
        self.page = await self.context.new_page()

    async def open_url(self, url: str) -> Dict[str, Any]:
        await self.ensure_started()
        assert self.page is not None
        await self.page.goto(url, wait_until="domcontentloaded")
        return await self.read_page()

    async def read_page(self) -> Dict[str, Any]:
        await self.ensure_started()
        assert self.page is not None
        title = await self.page.title()
        url = self.page.url
        structured = await self.page.evaluate(
            """() => {
                const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
                  .map(el => el.textContent?.trim() || '')
                  .filter(Boolean)
                  .slice(0, 10);
                const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
                  .map(el => el.textContent?.trim() || el.getAttribute('aria-label') || '')
                  .filter(Boolean)
                  .slice(0, 12);
                const inputs = Array.from(document.querySelectorAll('input, textarea'))
                  .map(el => ({
                    name: el.getAttribute('name') || el.getAttribute('id') || 'input',
                    type: el.getAttribute('type') || 'text',
                    placeholder: el.getAttribute('placeholder') || el.getAttribute('aria-label') || ''
                  }))
                  .slice(0, 10);
                return { headings, buttons, inputs, text: document.body?.innerText?.slice(0, 1200) || '' };
            }"""
        )
        return {
            "title": title,
            "url": url,
            "browser": self.browser_provider,
            **structured,
        }


if __name__ == "__main__":
    print("AIRA Playwright Browser Agent module ready.")
