"""Configuration and data-file loading."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List

from .errors import ConfigError


@dataclass
class ShoppingListItem:
    """A single item the user wants to keep stocked."""

    id: str
    name: str
    quantity: int = 1
    search_term: str = ""
    asin: str = ""
    url: str = ""

    @classmethod
    def from_dict(cls, raw: Dict[str, Any]) -> "ShoppingListItem":
        if "id" not in raw or "name" not in raw:
            raise ConfigError(f"Shopping list item is missing 'id' or 'name': {raw!r}")
        return cls(
            id=str(raw["id"]),
            name=str(raw["name"]),
            quantity=int(raw.get("quantity", 1)),
            search_term=str(raw.get("search_term", raw["name"])),
            asin=str(raw.get("asin", "")),
            url=str(raw.get("url", "")),
        )


@dataclass
class Config:
    """Top-level runtime configuration."""

    currency: str = "USD"
    fetcher: str = "mock"
    amazon_fresh_base_url: str = "https://www.amazon.com/alm/storefront"
    request_timeout_seconds: int = 20
    request_delay_seconds: float = 2.0
    user_agent: str = "Mozilla/5.0"
    paths: Dict[str, str] = field(default_factory=dict)
    order: Dict[str, Any] = field(default_factory=dict)
    base_dir: str = "."

    @classmethod
    def load(cls, path: str) -> "Config":
        raw = _read_json(path)
        base_dir = os.path.dirname(os.path.abspath(path))
        cfg = cls(
            currency=raw.get("currency", "USD"),
            fetcher=raw.get("fetcher", "mock"),
            amazon_fresh_base_url=raw.get(
                "amazon_fresh_base_url", "https://www.amazon.com/alm/storefront"
            ),
            request_timeout_seconds=int(raw.get("request_timeout_seconds", 20)),
            request_delay_seconds=float(raw.get("request_delay_seconds", 2.0)),
            user_agent=raw.get("user_agent", "Mozilla/5.0"),
            paths=raw.get("paths", {}),
            order=raw.get("order", {}),
            base_dir=base_dir,
        )
        return cfg

    def resolve(self, key: str) -> str:
        """Resolve a configured path relative to the config file's directory."""
        if key not in self.paths:
            raise ConfigError(f"Config 'paths.{key}' is not set.")
        p = self.paths[key]
        return p if os.path.isabs(p) else os.path.join(self.base_dir, p)


def load_shopping_list(path: str) -> List[ShoppingListItem]:
    raw = _read_json(path)
    items_raw = raw.get("items") if isinstance(raw, dict) else raw
    if not isinstance(items_raw, list):
        raise ConfigError(f"Shopping list at {path} must contain a list of 'items'.")
    items = [ShoppingListItem.from_dict(i) for i in items_raw]
    if not items:
        raise ConfigError(f"Shopping list at {path} is empty.")

    seen = set()
    for item in items:
        if item.id in seen:
            raise ConfigError(f"Duplicate shopping list item id: {item.id!r}")
        seen.add(item.id)
    return items


def load_baselines(path: str) -> Dict[str, float]:
    """Load baseline prices keyed by item id. Returns {} if file is absent."""
    if not os.path.exists(path):
        return {}
    raw = _read_json(path)
    if not isinstance(raw, dict):
        raise ConfigError(f"Baselines at {path} must be a JSON object {{id: price}}.")
    baselines: Dict[str, float] = {}
    for item_id, price in raw.items():
        try:
            baselines[str(item_id)] = float(price)
        except (TypeError, ValueError) as exc:
            raise ConfigError(
                f"Baseline price for {item_id!r} is not a number: {price!r}"
            ) from exc
    return baselines


def save_baselines(path: str, baselines: Dict[str, float]) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(baselines, fh, indent=2, sort_keys=True)
        fh.write("\n")


def _read_json(path: str) -> Any:
    if not os.path.exists(path):
        raise ConfigError(f"File not found: {path}")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except json.JSONDecodeError as exc:
        raise ConfigError(f"Invalid JSON in {path}: {exc}") from exc
