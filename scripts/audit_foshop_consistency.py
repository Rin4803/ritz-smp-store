from pathlib import Path
import re

base = Path('/home/ubuntu/ritz-smp-store')
price_text = (base / 'mcsv-economy-price-readonly.txt').read_text()
definitions = (base / 'mcsv-foshop-definitions-readonly.txt').read_text()

def section(text, path):
    marker = '### ' + path
    start = text.find(marker)
    if start < 0:
        return ''
    start = text.find('\n', start) + 1
    end = text.find('\n### ', start)
    return text[start:] if end < 0 else text[start:end]

def parse_global(text):
    out = {}
    current = None
    enabled = None
    for line in section(text, '/plugins/FoShop/global-sell-prices.yml').splitlines():
        m = re.match(r'^\s{2,}([A-Z][A-Z0-9_]+):\s*$', line)
        if m:
            current = m.group(1)
            enabled = None
        m = re.match(r'^\s+enabled:\s*(true|false)', line)
        if m and current:
            enabled = m.group(1) == 'true'
        m = re.match(r'^\s+price:\s*([-+]?[0-9]*\.?[0-9]+)', line)
        if m and current:
            out[current] = {'price': float(m.group(1)), 'enabled': enabled}
    return out

def parse_worth(text):
    out = {}
    for line in section(text, '/plugins/Essentials/worth.yml').splitlines():
        m = re.match(r'^\s*([A-Za-z0-9_]+):\s*([-+]?[0-9]*\.?[0-9]+)\s*$', line)
        if m:
            out[m.group(1).upper()] = float(m.group(2))
    return out

def parse_shops(text):
    shops = {}
    current_shop = None
    shop_enabled = False
    current_item = None
    item = None
    for line in text.splitlines():
        m = re.match(r'^### /plugins/FoShop/shops/([^/]+)\.yml$', line)
        if m:
            current_shop = m.group(1)
            shops[current_shop] = {'enabled': False, 'items': {}}
            current_item = None
            item = None
            continue
        if current_shop is None:
            continue
        m = re.match(r'^enabled:\s*(true|false)\s*$', line)
        if m and current_item is None:
            shops[current_shop]['enabled'] = m.group(1) == 'true'
            continue
        m = re.match(r'^  ([A-Za-z0-9_-]+):\s*$', line)
        if m and m.group(1) not in {'description', 'items'}:
            current_item = m.group(1)
            item = {}
            shops[current_shop]['items'][current_item] = item
            continue
        for key in ('material', 'amount', 'buy-price', 'sell-price'):
            m = re.match(r'^    ' + re.escape(key) + r':\s*(.+?)\s*$', line)
            if m and item is not None:
                value = m.group(1).strip().strip("'\"")
                item[key] = float(value) if key in ('amount', 'buy-price', 'sell-price') else value.upper()
    return shops

global_prices = parse_global(price_text)
worth = parse_worth(price_text)
shops = parse_shops(definitions)
shop_items = {}
for shop, data in shops.items():
    for item_id, item in data['items'].items():
        if 'material' in item and 'amount' in item and 'sell-price' in item:
            shop_items.setdefault(item['material'], []).append({
                'shop': shop, 'shop_enabled': data['enabled'], 'item_id': item_id,
                'amount': item['amount'], 'sell_price': item['sell-price'],
                'unit_sell': item['sell-price'] / item['amount'] if item['amount'] else None,
            })

print(f'Shops: {len(shops)}; enabled shops: {sum(1 for s in shops.values() if s["enabled"])}')
print(f'Shop item materials with sell-price: {len(shop_items)}')
print(f'Global price entries: {len(global_prices)}; enabled: {sum(1 for v in global_prices.values() if v["enabled"])}')
print(f'Essentials worth entries: {len(worth)}')
missing_global = sorted(m for m in shop_items if m not in global_prices)
print(f'Shop materials absent from global prices: {len(missing_global)}')
# Compare only enabled shop items against global fallback and Essentials worth.
shop_global_mismatch = []
shop_worth_mismatch = []
for material, rows in shop_items.items():
    for row in rows:
        if not row['shop_enabled']:
            continue
        if material in global_prices:
            gp = global_prices[material]['price']
            if abs(row['unit_sell'] - gp) > 1e-9:
                shop_global_mismatch.append((material, row['shop'], row['unit_sell'], gp))
        if material in worth:
            if abs(row['unit_sell'] - worth[material]) > 1e-9:
                shop_worth_mismatch.append((material, row['shop'], row['unit_sell'], worth[material]))
print(f'Enabled shop unit-sell vs global price mismatches: {len(shop_global_mismatch)}')
for x in shop_global_mismatch[:40]: print('GLOBAL_MISMATCH\t' + '\t'.join(map(str, x)))
print(f'Enabled shop unit-sell vs Essentials worth mismatches: {len(shop_worth_mismatch)}')
for x in shop_worth_mismatch[:40]: print('WORTH_MISMATCH\t' + '\t'.join(map(str, x)))
print('Enabled shop materials not in Essentials worth:', len([m for m in shop_items if any(r['shop_enabled'] for r in shop_items[m]) and m not in worth]))
