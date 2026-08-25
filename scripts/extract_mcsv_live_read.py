import json
from pathlib import Path

source = Path('/home/ubuntu/.mcp/tool-results/2026-08-25_17-31-10.879170571_ritzsmp_files_read_many_fc20b5b1.json')
out = Path('/home/ubuntu/ritz-smp-store/.mcsv-live-read')
data = json.loads(source.read_text())
files = data.get('files', [])
out.mkdir(exist_ok=True)
for item in files:
    path = item.get('path', '')
    content = item.get('content')
    if path and content is not None:
        target = out / path.lstrip('/')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding='utf-8')
print(f'extracted={len(files)}')
for item in files:
    print(item.get('path'), 'truncated=' + str(item.get('truncated')))
