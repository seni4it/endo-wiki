"""Price fetchers for Amazon Fresh items.

This module defines a small plug-in interface (:class:`PriceFetcher`) and a few
concrete implementations:

* :class:`MockFetcher` -- deterministic, offline prices for development, tests
  and demos. This is the default so the system runs out of the box.
* :class:`HttpScraperFetcher` -- a *documented stub* that shows how a real
  BeautifulSoup-based scraper would be wired in.

IMPORTANT -- a note on scraping Amazon Fresh
--------------------------------------------
Amazon Fresh prices live behind authentication, a selected delivery
address/ZIP, region-specific catalogs, bot detection and CAPTCHAs. Scraping
them programmatically generally violates Amazon's Terms of Service, and a plain
``requests`` + BeautifulSoup call will usually receive a login wall or a robot
check rather than a price.

For anything beyond a personal experiment you should prefer an official,
authorized data source (for example the Amazon Product Advertising API, the
Selling Partner API, or a licensed pricing-data provider). The
``HttpScraperFetcher`` below is intentionally conservative and is provided to
illustrate the parsing/error-handling structure, not to defeat bot protection.
"""

from __future__ import annotations

import abc
import hashlib
import random
import re
import time
from typing import Optional

from .config import Config, ShoppingListItem
from .errors import FetchError, ItemNotFoundError


class PriceFetcher(abc.ABC):
    """Abstract price source. Implementations return a price in the configured
    currency for a single shopping-list item, or raise :class:`FetchError`."""

    name = "base"

    @abc.abstractmethod
    def fetch_price(self, item: ShoppingListItem) -> float:
        """Return the current unit price for ``item`` or raise ``FetchError``."""
        raise NotImplementedError


class MockFetcher(PriceFetcher):
    """Deterministic offline fetcher.

    Produces a stable-but-jittered price per item id so the rest of the pipeline
    (comparison, ordering, logging) can be exercised without network access.
    The price hovers around a per-item pseudo-baseline and occasionally dips
    below it, which is exactly the "deal" condition we want to test.
    """

    name = "mock"

    def __init__(self, seed: Optional[int] = None) -> None:
        self._seed = seed

    def fetch_price(self, item: ShoppingListItem) -> float:
        # Simulate the occasional missing item so error handling is exercised.
        if "missing" in item.id.lower():
            raise ItemNotFoundError(f"Item not available at source: {item.id}")

        digest = hashlib.sha256(item.id.encode("utf-8")).hexdigest()
        anchor = 1.0 + (int(digest[:6], 16) % 1500) / 100.0  # ~ $1.00 - $16.00

        rng = random.Random(f"{item.id}:{self._seed}" if self._seed else digest)
        # +/- 20% jitter so prices sometimes land at or below baseline.
        jitter = rng.uniform(-0.20, 0.20)
        price = round(anchor * (1 + jitter), 2)
        return max(price, 0.01)


class HttpScraperFetcher(PriceFetcher):
    """BeautifulSoup-based scraper stub for a product page.

    This demonstrates the structure of a real fetcher: build a request with a
    realistic User-Agent, respect a polite delay, fetch the product URL and
    parse the price out of the HTML. It is deliberately defensive -- network and
    parsing failures are converted into :class:`FetchError` so the scheduler can
    continue with the remaining items.

    It requires ``requests`` and ``beautifulsoup4`` (see requirements.txt). If
    those are not installed, construction raises a clear error.
    """

    name = "http"

    # A few common selectors Amazon has used for prices. Real pages vary widely;
    # treat this as a starting point to adapt to whatever you actually receive.
    _PRICE_SELECTORS = (
        "span.a-price span.a-offscreen",
        "#corePrice_feature_div span.a-offscreen",
        "#priceblock_ourprice",
        "#priceblock_dealprice",
    )
    _PRICE_RE = re.compile(r"[-+]?\d{1,3}(?:[,\d]*)(?:\.\d{1,2})?")

    def __init__(self, config: Config) -> None:
        try:
            import requests  # noqa: F401
            from bs4 import BeautifulSoup  # noqa: F401
        except ImportError as exc:  # pragma: no cover - depends on env
            raise FetchError(
                "HttpScraperFetcher requires 'requests' and 'beautifulsoup4'. "
                "Install them with: pip install -r requirements.txt"
            ) from exc
        self._config = config
        self._last_request_at = 0.0

    def fetch_price(self, item: ShoppingListItem) -> float:
        if not item.url:
            raise ItemNotFoundError(
                f"Item {item.id!r} has no 'url' to scrape. Add a product URL or "
                f"ASIN to the shopping list."
            )

        html = self._get(item.url)
        price = self._parse_price(html)
        if price is None:
            raise FetchError(
                f"Could not locate a price on the page for {item.id!r}. The page "
                f"layout may have changed, or it may be a login/robot-check page."
            )
        return price

    def _get(self, url: str) -> str:
        import requests

        # Polite rate limiting between requests.
        delay = self._config.request_delay_seconds
        elapsed = time.time() - self._last_request_at
        if elapsed < delay:
            time.sleep(delay - elapsed)

        headers = {
            "User-Agent": self._config.user_agent,
            "Accept-Language": "en-US,en;q=0.9",
        }
        try:
            resp = requests.get(
                url, headers=headers, timeout=self._config.request_timeout_seconds
            )
        except requests.RequestException as exc:
            raise FetchError(f"Network error fetching {url}: {exc}") from exc
        finally:
            self._last_request_at = time.time()

        if resp.status_code != 200:
            raise FetchError(f"Unexpected HTTP {resp.status_code} for {url}")
        return resp.text

    def _parse_price(self, html: str) -> Optional[float]:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")
        for selector in self._PRICE_SELECTORS:
            node = soup.select_one(selector)
            if node and node.get_text(strip=True):
                match = self._PRICE_RE.search(node.get_text(strip=True))
                if match:
                    try:
                        return float(match.group(0).replace(",", ""))
                    except ValueError:
                        continue
        return None


def get_fetcher(config: Config) -> PriceFetcher:
    """Factory: build the fetcher named in ``config.fetcher``."""
    name = (config.fetcher or "mock").lower()
    if name == "mock":
        return MockFetcher()
    if name in ("http", "scraper", "beautifulsoup"):
        return HttpScraperFetcher(config)
    raise FetchError(
        f"Unknown fetcher {config.fetcher!r}. Use 'mock' or 'http'."
    )
