"""Audit logging: structured app log + append-only price-history CSV."""

from __future__ import annotations

import csv
import logging
import os
from datetime import datetime, timezone
from typing import Iterable, List

from .compare import PriceCheck

_PRICE_HISTORY_HEADER = [
    "timestamp_utc",
    "item_id",
    "item_name",
    "current_price",
    "baseline",
    "delta",
    "status",
    "error",
]


def setup_logger(log_file: str, verbose: bool = False) -> logging.Logger:
    """Configure a logger that writes both to a file and to the console."""
    logger = logging.getLogger("grocery_monitor")
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    for handler in logger.handlers[:]:
        handler.close()
        logger.removeHandler(handler)

    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

    os.makedirs(os.path.dirname(os.path.abspath(log_file)), exist_ok=True)
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setFormatter(fmt)
    file_handler.setLevel(logging.DEBUG)
    logger.addHandler(file_handler)

    console = logging.StreamHandler()
    console.setFormatter(fmt)
    console.setLevel(logging.DEBUG if verbose else logging.INFO)
    logger.addHandler(console)

    logger.propagate = False
    return logger


def append_price_history(path: str, checks: Iterable[PriceCheck]) -> None:
    """Append one row per price check to the history CSV, creating it if new."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    is_new = not os.path.exists(path) or os.path.getsize(path) == 0
    ts = datetime.now(timezone.utc).isoformat(timespec="seconds")

    with open(path, "a", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        if is_new:
            writer.writerow(_PRICE_HISTORY_HEADER)
        for check in checks:
            writer.writerow(
                [
                    ts,
                    check.item.id,
                    check.item.name,
                    "" if check.current_price is None else f"{check.current_price:.2f}",
                    "" if check.baseline is None else f"{check.baseline:.2f}",
                    "" if check.delta is None else f"{check.delta:.2f}",
                    check.status,
                    check.error or "",
                ]
            )


def log_run_summary(logger: logging.Logger, checks: List[PriceCheck]) -> None:
    deals = [c for c in checks if c.is_deal]
    errors = [c for c in checks if not c.ok]
    new_baselines = [c for c in checks if c.status == "new_baseline"]
    logger.info(
        "Run summary: %d checked, %d deal(s), %d new baseline(s), %d error(s).",
        len(checks),
        len(deals),
        len(new_baselines),
        len(errors),
    )
    for c in errors:
        logger.warning("  Error for %s: %s", c.item.id, c.error)
