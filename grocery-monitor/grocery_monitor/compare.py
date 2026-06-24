"""Compare current prices against stored baselines."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .config import ShoppingListItem


@dataclass
class PriceCheck:
    """Outcome of checking one item's current price against its baseline."""

    item: ShoppingListItem
    current_price: Optional[float]
    baseline: Optional[float]
    error: Optional[str] = None

    @property
    def ok(self) -> bool:
        """True if a current price was successfully obtained."""
        return self.current_price is not None and self.error is None

    @property
    def has_baseline(self) -> bool:
        return self.baseline is not None

    @property
    def is_deal(self) -> bool:
        """True when current price is at or below baseline (a buy signal).

        If there is no baseline yet we cannot call it a deal -- the current
        price becomes the new baseline instead (see ``delta`` / runner logic).
        """
        if not self.ok or not self.has_baseline:
            return False
        return self.current_price <= self.baseline  # type: ignore[operator]

    @property
    def delta(self) -> Optional[float]:
        """current - baseline (negative means cheaper than baseline)."""
        if not self.ok or not self.has_baseline:
            return None
        return round(self.current_price - self.baseline, 2)  # type: ignore[operator]

    @property
    def savings(self) -> float:
        """Per-unit savings vs baseline (0 if not a deal)."""
        d = self.delta
        if d is None or d >= 0:
            return 0.0
        return round(-d, 2)

    @property
    def status(self) -> str:
        if not self.ok:
            return "error"
        if not self.has_baseline:
            return "new_baseline"
        return "deal" if self.is_deal else "above_baseline"
