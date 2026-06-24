"""Tests for the grocery monitor pipeline.

Run with:  python -m pytest grocery-monitor/tests -q
        or  python -m unittest discover -s grocery-monitor/tests
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from grocery_monitor.audit import setup_logger  # noqa: E402
from grocery_monitor.compare import PriceCheck  # noqa: E402
from grocery_monitor.config import Config, ShoppingListItem  # noqa: E402
from grocery_monitor.errors import ItemNotFoundError  # noqa: E402
from grocery_monitor.fetchers import MockFetcher, PriceFetcher, get_fetcher  # noqa: E402
from grocery_monitor.order import build_cart_url, build_purchase_order  # noqa: E402
from grocery_monitor.runner import run_once  # noqa: E402


class StubFetcher(PriceFetcher):
    name = "stub"

    def __init__(self, prices):
        self._prices = prices

    def fetch_price(self, item):
        if item.id not in self._prices:
            raise ItemNotFoundError(item.id)
        return self._prices[item.id]


def _write(path, obj):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh)


def _make_config(tmp, fetcher="mock"):
    cfg_path = os.path.join(tmp, "config.json")
    _write(
        cfg_path,
        {
            "currency": "USD",
            "fetcher": fetcher,
            "paths": {
                "shopping_list": "data/list.json",
                "baselines": "data/baselines.json",
                "price_history": "data/history.csv",
                "orders_dir": "data/orders",
                "log_file": "logs/test.log",
            },
            "order": {"min_items_to_order": 1},
        },
    )
    os.makedirs(os.path.join(tmp, "data"), exist_ok=True)
    return Config.load(cfg_path)


class CompareTests(unittest.TestCase):
    def setUp(self):
        self.item = ShoppingListItem(id="x", name="X", quantity=2, asin="A1")

    def test_deal_when_at_or_below_baseline(self):
        self.assertTrue(PriceCheck(self.item, 3.00, 3.00).is_deal)  # equal counts
        self.assertTrue(PriceCheck(self.item, 2.50, 3.00).is_deal)
        self.assertFalse(PriceCheck(self.item, 3.50, 3.00).is_deal)

    def test_no_baseline_is_not_deal(self):
        check = PriceCheck(self.item, 3.00, None)
        self.assertEqual(check.status, "new_baseline")
        self.assertFalse(check.is_deal)

    def test_savings(self):
        self.assertEqual(PriceCheck(self.item, 2.00, 3.00).savings, 1.00)
        self.assertEqual(PriceCheck(self.item, 4.00, 3.00).savings, 0.0)

    def test_error_status(self):
        check = PriceCheck(self.item, None, 3.00, error="boom")
        self.assertEqual(check.status, "error")
        self.assertFalse(check.ok)


class OrderTests(unittest.TestCase):
    def test_cart_url_includes_asin_and_quantity(self):
        item = ShoppingListItem(id="x", name="X", quantity=2, asin="A1")
        cfg = Config(order={"cart_base_url": "https://amz/cart"})
        url = build_cart_url([PriceCheck(item, 2.0, 3.0)], cfg)
        self.assertIn("ASIN.1=A1", url)
        self.assertIn("Quantity.1=2", url)

    def test_no_asin_means_no_cart_url(self):
        item = ShoppingListItem(id="x", name="X", quantity=1)
        url = build_cart_url([PriceCheck(item, 2.0, 3.0)], Config())
        self.assertIsNone(url)

    def test_order_respects_min_items(self):
        item = ShoppingListItem(id="x", name="X", quantity=1, asin="A1")
        cfg = Config(order={"min_items_to_order": 2})
        self.assertIsNone(build_purchase_order([PriceCheck(item, 2.0, 3.0)], cfg))

    def test_order_totals(self):
        item = ShoppingListItem(id="x", name="X", quantity=2, asin="A1")
        cfg = Config(order={"min_items_to_order": 1})
        po = build_purchase_order([PriceCheck(item, 2.0, 3.0)], cfg)
        self.assertEqual(po["subtotal"], 4.0)
        self.assertEqual(po["estimated_savings_vs_baseline"], 2.0)


class FetcherTests(unittest.TestCase):
    def test_mock_is_deterministic(self):
        f = MockFetcher()
        item = ShoppingListItem(id="milk", name="Milk")
        self.assertEqual(f.fetch_price(item), f.fetch_price(item))

    def test_mock_missing_item_raises(self):
        f = MockFetcher()
        with self.assertRaises(ItemNotFoundError):
            f.fetch_price(ShoppingListItem(id="missing-thing", name="Gone"))

    def test_factory(self):
        self.assertIsInstance(get_fetcher(Config(fetcher="mock")), MockFetcher)


class RunnerTests(unittest.TestCase):
    def test_full_run_generates_order_and_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            cfg = _make_config(tmp)
            _write(
                cfg.resolve("shopping_list"),
                {
                    "items": [
                        {"id": "a", "name": "A", "quantity": 1, "asin": "AA"},
                        {"id": "b", "name": "B", "quantity": 2, "asin": "BB"},
                    ]
                },
            )
            _write(cfg.resolve("baselines"), {"a": 5.00, "b": 5.00})
            logger = setup_logger(cfg.resolve("log_file"))
            fetcher = StubFetcher({"a": 4.00, "b": 6.00})  # a is a deal, b is not

            result = run_once(cfg, logger=logger, fetcher=fetcher)

            self.assertIsNotNone(result.order)
            self.assertEqual(result.order["item_count"], 1)
            self.assertTrue(os.path.exists(result.order_path))
            self.assertTrue(os.path.exists(cfg.resolve("price_history")))
            with open(cfg.resolve("price_history"), encoding="utf-8") as fh:
                content = fh.read()
            self.assertIn("deal", content)
            self.assertIn("above_baseline", content)

    def test_run_seeds_missing_baselines(self):
        with tempfile.TemporaryDirectory() as tmp:
            cfg = _make_config(tmp)
            _write(
                cfg.resolve("shopping_list"),
                {"items": [{"id": "a", "name": "A", "asin": "AA"}]},
            )
            _write(cfg.resolve("baselines"), {})
            logger = setup_logger(cfg.resolve("log_file"))
            fetcher = StubFetcher({"a": 4.00})

            result = run_once(cfg, logger=logger, fetcher=fetcher)
            self.assertIsNone(result.order)  # no baseline yet -> not a deal
            with open(cfg.resolve("baselines"), encoding="utf-8") as fh:
                self.assertEqual(json.load(fh), {"a": 4.00})

    def test_run_survives_fetch_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            cfg = _make_config(tmp)
            _write(
                cfg.resolve("shopping_list"),
                {
                    "items": [
                        {"id": "a", "name": "A", "asin": "AA"},
                        {"id": "gone", "name": "Gone", "asin": "GG"},
                    ]
                },
            )
            _write(cfg.resolve("baselines"), {"a": 5.00, "gone": 5.00})
            logger = setup_logger(cfg.resolve("log_file"))
            fetcher = StubFetcher({"a": 4.00})  # "gone" will raise

            result = run_once(cfg, logger=logger, fetcher=fetcher)
            statuses = {c.item.id: c.status for c in result.checks}
            self.assertEqual(statuses["a"], "deal")
            self.assertEqual(statuses["gone"], "error")
            self.assertIsNotNone(result.order)  # the good item still orders


if __name__ == "__main__":
    unittest.main()
