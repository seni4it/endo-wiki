"""Custom exceptions for the grocery monitor."""


class GroceryMonitorError(Exception):
    """Base class for all grocery monitor errors."""


class ConfigError(GroceryMonitorError):
    """Raised when configuration or data files are missing or malformed."""


class FetchError(GroceryMonitorError):
    """Raised when a price could not be fetched (network, parsing, etc.)."""


class ItemNotFoundError(FetchError):
    """Raised when a requested item could not be located at the source."""
