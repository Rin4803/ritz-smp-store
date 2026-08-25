"""Compare Essentials worth.yml and FoShop global sell prices from an MCSV JSON export.

The input must be a JSON file returned by the MCSV ``files_read_many`` operation.
This script is read-only and never connects to or writes to a server.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError as exc:  # pragma: no cover - environment/setup failure
    raise SystemExit(f"PyYAML unavailable: {exc}") from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "input_json",
        type=Path,
        help="path to the JSON response from MCSV files_read_many",
    )
    return parser.parse_args()


def load_contents(path: Path) -> dict[str, str]:
    payload: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return {
        item["path"]: item["content"]
        for item in payload.get("files", [])
        if "path" in item and "content" in item
    }


def main() -> None:
    args = parse_args()
    contents = load_contents(args.input_json)
    required = ["/plugins/Essentials/worth.yml", "/plugins/FoShop/global-sell-prices.yml"]
    missing = [path for path in required if path not in contents]
    if missing:
        raise SystemExit(f"missing required paths in input JSON: {', '.join(missing)}")

    worth = yaml.safe_load(contents[required[0]]) or {}
    foshop_doc = yaml.safe_load(contents[required[1]]) or {}
    config_doc = yaml.safe_load(contents.get("/plugins/FoShop/config.yml", "{}")) or {}
    items = foshop_doc.get("items", {}) or {}

    print("Essentials entries:", len(worth))
    print("FoShop fallback entries:", len(items))
    print(
        "FoShop global-sell-prices.enabled:",
        config_doc.get("global-sell-prices", {}).get("enabled"),
    )
    print(
        "FoShop enabled fallback entries:",
        sum(1 for value in items.values() if isinstance(value, dict) and value.get("enabled") is True),
    )
    print(
        "FoShop disabled fallback entries:",
        sum(1 for value in items.values() if isinstance(value, dict) and value.get("enabled") is False),
    )

    missing_in_essentials: list[str] = []
    missing_in_foshop: list[str] = []
    price_mismatch: list[tuple[str, object, object]] = []
    normalized_worth = {str(material).lower(): value for material, value in worth.items()}
    normalized_items = {str(material).upper(): value for material, value in items.items()}

    for material, entry in items.items():
        foshop_price = entry.get("price") if isinstance(entry, dict) else None
        worth_value = normalized_worth.get(str(material).lower())
        if worth_value is None:
            missing_in_essentials.append(str(material))
        elif isinstance(foshop_price, (int, float)) and float(worth_value) != float(foshop_price):
            price_mismatch.append((str(material), worth_value, foshop_price))

    for material in worth:
        if str(material).upper() not in normalized_items:
            missing_in_foshop.append(str(material))

    print("Fallback items missing in Essentials worth:", len(missing_in_essentials), missing_in_essentials[:20])
    print("Essentials worth items missing in FoShop fallback:", len(missing_in_foshop), missing_in_foshop[:20])
    print("Same-key numeric price mismatches:", len(price_mismatch), price_mismatch[:30])


if __name__ == "__main__":
    main()
