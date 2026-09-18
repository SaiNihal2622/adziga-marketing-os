import os
import sys

count_total = 0
for dirpath, _, files in os.walk('src'):
    for fn in files:
        if not fn.endswith(('.tsx', '.ts')):
            continue
        p = os.path.join(dirpath, fn)
        with open(p, 'rb') as f:
            d = f.read()
        original = d
        # Replace ??? as part of JSX literal text or template string
        # Common cases:
        #  - "???{expr}" -> "INR {expr}" or just "{expr}"
        #  - "???" standalone -> "Rs."
        #  - "???" between quotes -> ""
        # We do generic: drop standalone ??? but keep INR where it was clearly meant for currency.

        # Heuristic: ??? immediately followed by { or before { is currency -> INR
        d = d.replace(b'???{', b'INR {')

        # Remaining ??? should be emoji/glyphs that lost bytes. Replace with empty.
        # But only safe in text contexts (not comments). Since we can't tell, just replace.
        d = d.replace(b'???', b'')

        if d != original:
            with open(p, 'wb') as f:
                f.write(d)
            count_total += 1
print(f'Updated {count_total} files')