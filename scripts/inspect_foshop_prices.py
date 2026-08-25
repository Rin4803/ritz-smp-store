"""Inspect FoShop global sell price YAML from an MCSV JSON export.

The input must be a JSON file returned by the MCSV ``files_read_many`` operation.
This script is read-only and never connects to or writes to a server.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "input_json",
        type=Path,
        help="path to the JSON response from MCSV files_read_many",
    )
    parser.add_argument(
        "--max-lines",
        type=int,
        default=180,
        help="maximum number of initial YAML lines to print (default: 180)",
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
    source = "/plugins/FoShop/global-sell-prices.yml"
    if source not in contents:
        raise SystemExit(f"missing required path in input JSON: {source}")

    lines = contents[source].splitlines()
    print(f"--- first {max(args.max_lines, 0)} lines ---")
    for index, line in enumerate(lines[: max(args.max_lines, 0)], 1):
        print(f"{index}: {line}")

    print("--- matching control/item lines ---")
    pattern = re.compile(r"(^|\\s)(enabled|item|material|price|worth|sell|value)\\s*:", re.I)
    for index, line in enumerate(lines, 1):
        if pattern.search(line):
            print(f"{index}: {line}")
            if index > 500:
                break


if __name__ == "__main__":
    main()
