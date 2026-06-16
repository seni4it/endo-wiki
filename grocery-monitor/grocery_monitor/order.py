"""Generate a purchase order from the items that met the buy criteria."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

from .compare import PriceCheck
from .config import Config


def build_purchase_order(
    deals: List[PriceCheck],
    config: Config,
) -> Optional[Dict[str, Any]]:
    """Build a purchase-order payload from the deal checks.

    Returns ``None`` if the order does not meet the configured thresholds
    (``order.min_items_to_order`` / ``order.require_all_items``).
    """
    order_cfg = config.order or {}
    min_items = int(order_cfg.get("min_items_to_order", 1))
    if len(deals) < min_items:
        return None

    line_items = []
    total = 0.0
    total_savings = 0.0
    for check in deals:
        qty = check.item.quantity
        line_total = round((check.current_price or 0.0) * qty, 2)
        total += line_total
        total_savings += round(check.savings * qty, 2)
        line_items.append(
            {
                "item_id": check.item.id,
                "name": check.item.name,
                "asin": check.item.asin,
                "url": check.item.url,
                "quantity": qty,
                "unit_price": check.current_price,
                "baseline": check.baseline,
                "line_total": line_total,
                "unit_savings_vs_baseline": check.savings,
            }
        )

    order = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "currency": config.currency,
        "status": "pending_approval",
        "item_count": len(line_items),
        "subtotal": round(total, 2),
        "estimated_savings_vs_baseline": round(total_savings, 2),
        "line_items": line_items,
        "cart_url": build_cart_url(deals, config),
        "approval": {
            "instructions": (
                "Review the line items, then open 'cart_url' to add everything "
                "to your Amazon cart in one click. No purchase is made "
                "automatically; you approve at checkout."
            ),
        },
    }
    return order


def build_cart_url(deals: List[PriceCheck], config: Config) -> Optional[str]:
    """Build an Amazon 'add to cart' deep link from ASINs.

    Uses the classic ``/gp/aws/cart/add.html?ASIN.1=..&Quantity.1=..`` form.
    Items without an ASIN are skipped. Returns ``None`` if no item has an ASIN.
    """
    base = (config.order or {}).get(
        "cart_base_url", "https://www.amazon.com/gp/aws/cart/add.html"
    )
    params: Dict[str, str] = {}
    idx = 0
    for check in deals:
        if not check.item.asin:
            continue
        idx += 1
        params[f"ASIN.{idx}"] = check.item.asin
        params[f"Quantity.{idx}"] = str(check.item.quantity)
    if idx == 0:
        return None
    return f"{base}?{urlencode(params)}"


def save_order(order: Dict[str, Any], orders_dir: str) -> str:
    """Persist the order as a timestamped JSON file. Returns the file path."""
    os.makedirs(orders_dir, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(orders_dir, f"order_{stamp}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(order, fh, indent=2)
        fh.write("\n")
    return path


def format_order_text(order: Dict[str, Any]) -> str:
    """Human-readable summary of a purchase order for console/email."""
    lines = [
        "=" * 60,
        "PURCHASE ORDER (pending your approval)",
        f"Generated: {order['generated_at_utc']}",
        "=" * 60,
    ]
    for li in order["line_items"]:
        lines.append(
            f"  {li['quantity']:>2} x {li['name']:<34} "
            f"@ {order['currency']} {li['unit_price']:.2f} "
            f"= {order['currency']} {li['line_total']:.2f} "
            f"(saves {order['currency']} {li['unit_savings_vs_baseline']:.2f}/ea)"
        )
    lines.append("-" * 60)
    lines.append(
        f"  Subtotal: {order['currency']} {order['subtotal']:.2f}   "
        f"Est. savings: {order['currency']} {order['estimated_savings_vs_baseline']:.2f}"
    )
    if order.get("cart_url"):
        lines.append("")
        lines.append("  One-click cart link:")
        lines.append(f"  {order['cart_url']}")
    lines.append("=" * 60)
    return "\n".join(lines)
