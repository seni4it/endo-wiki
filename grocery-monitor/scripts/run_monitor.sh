#!/usr/bin/env bash
# Wrapper for scheduled (cron/systemd) execution of the grocery monitor.
# Resolves its own location so it works regardless of the caller's cwd.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# Activate a virtualenv if present (optional).
if [[ -f ".venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source ".venv/bin/activate"
fi

exec python -m grocery_monitor.cli run --config "${GROCERY_CONFIG:-config.json}"
