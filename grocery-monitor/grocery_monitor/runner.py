"""Orchestrate a single monitoring run: fetch -> compare -> order -> log."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Dict, List, Optional

from . import audit, order as order_mod
from .compare import PriceCheck
from .config import Config, ShoppingListItem, load_baselines, load_shopping_list, save_baselines
from .errors import FetchError
from .fetchers import PriceFetcher, get_fetcher


@dataclass
class RunResult:
    checks: List[PriceCheck]
    order: Optional[Dict] = None
    order_path: Optional[str] = None


def run_once(
    config: Config,
    *,
    logger: Optional[logging.Logger] = None,
    fetcher: Optional[PriceFetcher] = None,
    update_baselines: bool = True,
) -> RunResult:
    """Execute one full monitoring cycle and return the result.

    Steps:
      1. Load shopping list + baselines.
      2. Fetch the current price for each item (errors are captured per item).
      3. Compare against baselines to find deals.
      4. Generate + persist a purchase order if criteria are met.
      5. Append to the price-history CSV and write a summary to the log.
    """
    logger = logger or logging.getLogger("grocery_monitor")
    fetcher = fetcher or get_fetcher(config)

    items = load_shopping_list(config.resolve("shopping_list"))
    baselines = load_baselines(config.resolve("baselines"))
    logger.info(
        "Starting run: %d item(s), fetcher=%s, %d baseline(s) loaded.",
        len(items),
        fetcher.name,
        len(baselines),
    )

    checks = [_check_item(item, baselines, fetcher, logger) for item in items]

    # Record price history for auditing before anything else can fail.
    audit.append_price_history(config.resolve("price_history"), checks)

    deals = [c for c in checks if c.is_deal]
    result = RunResult(checks=checks)

    if deals:
        po = order_mod.build_purchase_order(deals, config)
        if po is not None:
            path = order_mod.save_order(po, config.resolve("orders_dir"))
            result.order = po
            result.order_path = path
            logger.info(
                "Generated purchase order with %d item(s) -> %s",
                po["item_count"],
                path,
            )
        else:
            logger.info(
                "%d deal(s) found but order thresholds not met; no order created.",
                len(deals),
            )
    else:
        logger.info("No deals at or below baseline this run.")

    if update_baselines:
        _seed_missing_baselines(checks, baselines, config, logger)

    audit.log_run_summary(logger, checks)
    return result


def _check_item(
    item: ShoppingListItem,
    baselines: Dict[str, float],
    fetcher: PriceFetcher,
    logger: logging.Logger,
) -> PriceCheck:
    """Fetch + compare a single item, converting any failure into a PriceCheck."""
    baseline = baselines.get(item.id)
    try:
        price = fetcher.fetch_price(item)
    except FetchError as exc:
        logger.warning("Failed to fetch %s (%s): %s", item.id, item.name, exc)
        return PriceCheck(item=item, current_price=None, baseline=baseline, error=str(exc))
    except Exception as exc:  # defensive: never let one item kill the run
        logger.exception("Unexpected error fetching %s", item.id)
        return PriceCheck(
            item=item, current_price=None, baseline=baseline,
            error=f"unexpected: {exc}",
        )

    check = PriceCheck(item=item, current_price=price, baseline=baseline)
    logger.info(
        "  %-22s current=%.2f baseline=%s -> %s",
        item.id,
        price,
        f"{baseline:.2f}" if baseline is not None else "none",
        check.status,
    )
    return check


def _seed_missing_baselines(
    checks: List[PriceCheck],
    baselines: Dict[str, float],
    config: Config,
    logger: logging.Logger,
) -> None:
    """For items with no baseline, adopt the first successful price as baseline.

    This makes the system self-initializing: the first run records baselines,
    and subsequent runs compare against them.
    """
    added = {}
    for c in checks:
        if c.ok and not c.has_baseline:
            added[c.item.id] = c.current_price
    if not added:
        return
    baselines.update(added)
    save_baselines(config.resolve("baselines"), baselines)
    logger.info("Seeded %d new baseline(s): %s", len(added), ", ".join(added))
