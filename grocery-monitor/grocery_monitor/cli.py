"""Command-line entrypoint for the grocery price monitor.

Examples
--------
    # one monitoring cycle using config.json
    python -m grocery_monitor.cli run --config config.json

    # re-set baselines to the current observed prices
    python -m grocery_monitor.cli set-baselines --config config.json

    # show the current shopping list / baseline pairing
    python -m grocery_monitor.cli show --config config.json
"""

from __future__ import annotations

import argparse
import json
import sys

from . import audit
from .config import Config, load_baselines, load_shopping_list, save_baselines
from .errors import GroceryMonitorError
from .fetchers import get_fetcher
from .order import format_order_text
from .runner import run_once


def main(argv=None) -> int:
    # Shared options usable either before OR after the subcommand, so both
    # `cli.py --config c.json run` and `cli.py run --config c.json` work.
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--config", default="config.json", help="Path to config JSON (default: config.json)"
    )
    common.add_argument("--verbose", action="store_true", help="Verbose (DEBUG) logging")

    parser = argparse.ArgumentParser(
        prog="grocery-monitor",
        description="Monitor grocery prices and generate purchase orders.",
        parents=[common],
    )

    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("run", parents=[common], help="Run one monitoring cycle")
    sub.add_parser("show", parents=[common], help="Show shopping list and baselines")
    p_set = sub.add_parser(
        "set-baselines",
        parents=[common],
        help="Overwrite baselines with current fetched prices",
    )
    p_set.add_argument(
        "--missing-only",
        action="store_true",
        help="Only set baselines for items that don't have one yet",
    )

    args = parser.parse_args(argv)

    try:
        config = Config.load(args.config)
    except GroceryMonitorError as exc:
        print(f"Config error: {exc}", file=sys.stderr)
        return 2

    logger = audit.setup_logger(config.resolve("log_file"), verbose=args.verbose)

    try:
        if args.command == "run":
            return _cmd_run(config, logger)
        if args.command == "show":
            return _cmd_show(config)
        if args.command == "set-baselines":
            return _cmd_set_baselines(config, logger, args.missing_only)
    except GroceryMonitorError as exc:
        logger.error("%s", exc)
        return 1
    return 0


def _cmd_run(config, logger) -> int:
    result = run_once(config, logger=logger)
    if result.order:
        print()
        print(format_order_text(result.order))
        print(f"\nSaved order: {result.order_path}")
    else:
        print("\nNo purchase order generated this run.")
    # Non-zero exit if every item errored, so schedulers can alert.
    if all(not c.ok for c in result.checks):
        logger.error("All items failed to fetch.")
        return 1
    return 0


def _cmd_show(config) -> int:
    items = load_shopping_list(config.resolve("shopping_list"))
    baselines = load_baselines(config.resolve("baselines"))
    rows = []
    for item in items:
        rows.append(
            {
                "id": item.id,
                "name": item.name,
                "quantity": item.quantity,
                "baseline": baselines.get(item.id),
            }
        )
    print(json.dumps({"currency": config.currency, "items": rows}, indent=2))
    return 0


def _cmd_set_baselines(config, logger, missing_only: bool) -> int:
    items = load_shopping_list(config.resolve("shopping_list"))
    baselines = load_baselines(config.resolve("baselines"))
    fetcher = get_fetcher(config)

    updated = dict(baselines)
    changed = 0
    for item in items:
        if missing_only and item.id in baselines:
            continue
        try:
            price = fetcher.fetch_price(item)
        except GroceryMonitorError as exc:
            logger.warning("Skipping %s: %s", item.id, exc)
            continue
        updated[item.id] = price
        changed += 1
        logger.info("baseline %s = %.2f", item.id, price)

    save_baselines(config.resolve("baselines"), updated)
    print(f"Updated {changed} baseline(s) -> {config.resolve('baselines')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
