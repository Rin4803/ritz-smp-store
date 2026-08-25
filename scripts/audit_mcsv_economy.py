from pathlib import Path
import re

text = Path('/home/ubuntu/ritz-smp-store/mcsv-economy-price-readonly.txt').read_text()
sections = {}
current = None
for line in text.splitlines():
    if line.startswith('### '):
        current = line[4:].strip()
        sections[current] = []
    elif current:
        sections[current].append(line)

def parse_prices(lines):
    out = {}
    current = None
    enabled = None
    for line in lines:
        # FoShop uses nested MATERIAL -> enabled/price; Essentials worth uses material: value.
        nested = re.match(r'^\s{2,}([A-Z][A-Z0-9_]+):\s*$', line)
        simple = re.match(r'^\s*([A-Za-z0-9_]+):\s*([-+]?[0-9]*\.?[0-9]+)\s*$', line)
        if nested:
            current = nested.group(1).upper()
            enabled = None
            continue
        if simple:
            key, value = simple.group(1).upper(), float(simple.group(2))
            if key not in {'ENABLED', 'PRICE'}:
                out[key] = {'price': value, 'enabled': True}
                continue
        m = re.match(r'^\s+enabled:\s*(true|false)', line)
        if m and current:
            enabled = m.group(1) == 'true'
            continue
        m = re.match(r'^\s+price:\s*([-+]?[0-9]*\.?[0-9]+)', line)
        if m and current:
            out[current] = {'price': float(m.group(1)), 'enabled': enabled}
    return out

fos = parse_prices(sections.get('/plugins/FoShop/global-sell-prices.yml', []))
ess = parse_prices(sections.get('/plugins/Essentials/worth.yml', []))
print(f'FoShop entries: {len(fos)}')
print(f'Essentials worth entries parsed: {len(ess)}')
print(f'FoShop enabled: {sum(1 for v in fos.values() if v["enabled"] is True)}')
print(f'FoShop disabled: {sum(1 for v in fos.values() if v["enabled"] is False)}')
common = sorted(set(fos) & set(ess))
print(f'Common material keys: {len(common)}')
missing_worth = sorted(k for k,v in fos.items() if v['enabled'] and k not in ess)
print(f'FoShop enabled but absent from Essentials worth: {len(missing_worth)}')
print('Missing sample:', ', '.join(missing_worth[:30]))
zero = sorted(k for k,v in fos.items() if v['enabled'] and v['price'] <= 0)
print(f'FoShop enabled with non-positive price: {len(zero)}')
print('Zero sample:', ', '.join(zero[:30]))
# detect likely arbitrage / suspicious high prices by simple top list, not a policy decision
for k,v in sorted(((k,v) for k,v in fos.items() if v['enabled']), key=lambda x:x[1]['price'], reverse=True)[:20]:
    print(f'TOP\t{k}\t{v["price"]}')
