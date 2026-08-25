import re
from pathlib import Path
lines = Path('/home/ubuntu/ritz-smp-store/mcsv-economy-price-readonly.txt').read_text().splitlines()
s = next(i for i, x in enumerate(lines) if x == '### /plugins/FoShop/global-sell-prices.yml')
for offset in (10, 11, 12):
    line = lines[s + offset]
    print(offset, repr(line))
    print('nested', bool(re.match(r'^\s{2,}([A-Z][A-Z0-9_]+):\s*$', line)))
    print('enabled', bool(re.match(r'^\s+enabled:\s*(true|false)', line)))
    print('price', bool(re.match(r'^\s+price:\s*([-+]?[0-9]*\.?[0-9]+)', line)))
