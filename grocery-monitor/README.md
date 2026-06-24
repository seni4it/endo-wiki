# Grocery Price Monitor

Monitors a grocery shopping list, checks current prices (Amazon Fresh style),
compares them against **baseline** prices, and — when an item is at or below its
baseline — generates a **purchase order** as a JSON payload and a one-click
Amazon "add to cart" link that you can quickly approve. Every price check and
order is logged for auditing, and the whole thing is built to run on a schedule
(cron / systemd).

> **No purchase is ever made automatically.** The system only *prepares* an
> order for you to approve at checkout.

---

## Contents

```
grocery-monitor/
├── grocery_monitor/          # the Python package
│   ├── cli.py                # command-line entrypoint  (python -m grocery_monitor.cli)
│   ├── config.py             # load config, shopping list, baselines
│   ├── fetchers.py           # pluggable price sources (mock + BeautifulSoup scraper)
│   ├── compare.py            # baseline comparison / "is this a deal?" logic
│   ├── order.py              # purchase-order + cart-link generation
│   ├── audit.py              # logging + append-only price-history CSV
│   ├── runner.py             # orchestrates one fetch→compare→order→log cycle
│   └── errors.py             # typed exceptions
├── data/                     # *.example.json templates (your live files are gitignored)
├── scripts/                  # cron / systemd scheduling helpers
├── tests/                    # unittest suite (no network needed)
├── config.example.json
└── requirements.txt
```

---

## How it works (the seven steps)

1. **Fetch current prices** for each list item via a `PriceFetcher`
   (`grocery_monitor/fetchers.py`). The default `mock` fetcher needs no network;
   an `http` fetcher shows how to scrape a product page with BeautifulSoup.
2. **Store baselines** per item in `data/baselines.json` (JSON `{id: price}`).
   The first run *self-seeds* a baseline from the observed price; price history
   is also appended to a CSV for trend tracking.
3. **Compare** current vs baseline — an item is a *deal* when
   `current_price <= baseline` (`compare.py`).
4. **Generate a purchase order** for the deals: a JSON payload plus a clickable
   `https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=…&Quantity.1=…` cart link
   (`order.py`), saved to `data/orders/`.
5. **Log everything** — a human-readable app log (`logs/grocery_monitor.log`) and
   a machine-readable price-history CSV (`data/price_history.csv`) (`audit.py`).
6. **Run on a schedule** — `scripts/run_monitor.sh` plus cron / systemd units in
   `scripts/` (daily or weekly).
7. **Error handling** — network failures, missing items, and pricing gaps are
   caught **per item**, recorded with an `error` status, and never abort the
   rest of the run (`runner.py`).

---

## Setup

Requires **Python 3.9+**. The default `mock` fetcher has **no third-party
dependencies**, so you can try it immediately.

```bash
cd grocery-monitor

# 1. Create your live config + data from the examples
cp config.example.json config.json
cp data/shopping_list.example.json data/shopping_list.json
cp data/baselines.example.json     data/baselines.json   # optional; can self-seed

# 2. (Only needed for the 'http' scraper) install scraping deps
python -m pip install -r requirements.txt
```

`config.json`, your live data files, logs, and orders are all git-ignored.

---

## Usage

```bash
# Run one monitoring cycle
python -m grocery_monitor.cli run --config config.json

# Show the current shopping list paired with baselines
python -m grocery_monitor.cli show --config config.json

# (Re)capture baselines from the current fetched prices
python -m grocery_monitor.cli set-baselines --config config.json
python -m grocery_monitor.cli set-baselines --missing-only   # only items lacking one
```

Example output:

```
PURCHASE ORDER (pending your approval)
============================================================
   1 x Whole Milk, 1 Gallon               @ USD 2.69 = USD 2.69 (saves USD 1.60/ea)
------------------------------------------------------------
  Subtotal: USD 2.69   Est. savings: USD 1.60

  One-click cart link:
  https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=B0EXAMPLE01&Quantity.1=1
```

Exit codes: `0` success, `1` runtime error (or all items failed to fetch),
`2` configuration error — handy for alerting from a scheduler.

---

## Configuration

`config.json`:

| Key | Meaning |
| --- | --- |
| `currency` | Display currency label (e.g. `USD`). |
| `fetcher` | `mock` (offline default) or `http` (BeautifulSoup scraper). |
| `request_timeout_seconds` / `request_delay_seconds` | HTTP timeout & polite delay. |
| `user_agent` | User-Agent for the `http` fetcher. |
| `paths.*` | Locations of the shopping list, baselines, price history, orders dir, log file (relative to the config file). |
| `order.min_items_to_order` | Minimum number of deals before an order is generated. |
| `order.cart_base_url` | Base URL for the add-to-cart deep link. |

**Shopping list** (`data/shopping_list.json`) — one object per item:

```json
{
  "items": [
    {
      "id": "milk-whole-1gal",          // stable unique key (used in baselines/history)
      "name": "Whole Milk, 1 Gallon",
      "quantity": 1,
      "search_term": "whole milk 1 gallon",
      "asin": "B0EXAMPLE01",            // needed for the one-click cart link
      "url": "https://www.amazon.com/dp/B0EXAMPLE01"  // needed for the http scraper
    }
  ]
}
```

**Baselines** (`data/baselines.json`) — `{item_id: price}`. Omit it to let the
first run seed baselines automatically.

---

## Scheduling

```bash
# Cron — see scripts/grocery-monitor.cron for ready-to-edit lines
0 7 * * * /path/to/grocery-monitor/scripts/run_monitor.sh >> /path/to/grocery-monitor/logs/cron.log 2>&1

# systemd — see scripts/systemd/
sudo cp scripts/systemd/grocery-monitor.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now grocery-monitor.timer
```

---

## Adding a real price source

Implement the small `PriceFetcher` interface and register it in
`get_fetcher()`:

```python
from grocery_monitor.fetchers import PriceFetcher

class MyFetcher(PriceFetcher):
    name = "mine"
    def fetch_price(self, item):       # return float, or raise FetchError
        ...
```

### ⚠️ A note on scraping Amazon Fresh

Amazon Fresh prices sit behind **login, a selected delivery ZIP, regional
catalogs, bot detection and CAPTCHAs**, and scraping them generally **violates
Amazon's Terms of Service**. A plain `requests` + BeautifulSoup call will
usually get a login wall or robot check rather than a price — so the included
`HttpScraperFetcher` is a *documented, conservative stub* that demonstrates the
parsing/error-handling structure, **not** a way to defeat bot protection.

For anything beyond a personal experiment, use an **authorized** data source —
e.g. the Amazon Product Advertising API, the Selling Partner API, or a licensed
pricing-data provider — and drop it behind the same `PriceFetcher` interface.

---

## Testing

```bash
python -m unittest discover -s tests      # or: python -m pytest tests -q
```

The suite (14 tests) covers comparison logic, order/cart-link generation, the
mock fetcher, baseline self-seeding, and per-item error resilience — all
offline.
