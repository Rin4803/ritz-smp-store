from pathlib import Path
import re

ROOT = Path('/home/ubuntu/ritz-smp-store/.mcsv-live-read/plugins')
OUT = Path('/home/ubuntu/ritz-smp-store/economy-patch-preview')
GLOBAL = ROOT / 'FoShop/global-sell-prices.yml'
WORTH = ROOT / 'Essentials/worth.yml'
SHOPS = sorted((ROOT / 'FoShop/shops').glob('*.yml'))

global_prices = {}
current = None
for line in GLOBAL.read_text(encoding='utf-8').splitlines():
    match = re.match(r'^  ([A-Z0-9_]+):\s*$', line)
    if match:
        current = match.group(1)
        continue
    match = re.match(r'^    price:\s*([-+]?[0-9]+(?:\.[0-9]+)?)\s*$', line)
    if match and current:
        global_prices[current] = float(match.group(1))

# FoShop shop sell-price is a package total. Essentials /worth is per item.
# Use the existing shop override per-item price first, then global fallback.
shop_unit_prices = {}
for shop in SHOPS:
    material = None
    amount = None
    sell = None
    for line in shop.read_text(encoding='utf-8').splitlines():
        match = re.match(r'^    material:\s*([A-Z0-9_]+)\s*$', line)
        if match:
            material = match.group(1)
        match = re.match(r'^    amount:\s*([0-9]+)\s*$', line)
        if match:
            amount = int(match.group(1))
        match = re.match(r'^    sell-price:\s*([-+]?[0-9]+(?:\.[0-9]+)?)\s*$', line)
        if match:
            sell = float(match.group(1))
        if material and amount and sell is not None:
            shop_unit_prices[material] = sell / amount
            material = None
            amount = None
            sell = None

worth_lines = WORTH.read_text(encoding='utf-8').splitlines()
seen = set()
new_worth = []
for line in worth_lines:
    match = re.match(r'^([a-z0-9_]+):\s*[-+]?[0-9]+(?:\.[0-9]+)?\s*$', line)
    if match:
        key = match.group(1).upper()
        if key in shop_unit_prices or key in global_prices:
            price = shop_unit_prices.get(key, global_prices[key])
            new_worth.append(f'{match.group(1)}: {price:.2f}')
            seen.add(key)
            continue
    new_worth.append(line)
new_worth.append('')
new_worth.append('# Added from FoShop prices so /worth matches the sell fallback.')
for key in sorted(global_prices):
    if key not in seen:
        price = shop_unit_prices.get(key, global_prices[key])
        new_worth.append(f'{key.lower()}: {price:.2f}')

OUT.mkdir(exist_ok=True)
(OUT / 'plugins/Essentials').mkdir(parents=True, exist_ok=True)
(OUT / 'plugins/FoShop/shops').mkdir(parents=True, exist_ok=True)
(OUT.joinpath('plugins/Essentials/worth.yml')).write_text('\n'.join(new_worth) + '\n', encoding='utf-8')

# Keep every FoShop shop file byte-for-byte equivalent in the patch preview.
for shop in SHOPS:
    (OUT / 'plugins/FoShop/shops' / shop.name).write_text(shop.read_text(encoding='utf-8'), encoding='utf-8')

print(f'global_items={len(global_prices)}')
print(f'shop_override_items={len(shop_unit_prices)}')
print(f'worth_output_lines={len(new_worth)}')
print('shop_sell_price_changes=0')
print(f'output={OUT}')
