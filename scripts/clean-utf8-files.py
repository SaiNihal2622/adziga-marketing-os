import os
import sys

# Clean UTF-8 issues in all .tsx and .ts files under src/
root = sys.argv[1] if len(sys.argv) > 1 else r'src'
mapping = {
    b'\xe2\x80\x94': b'-',  # em-dash
    b'\xe2\x80\x93': b'-',  # en-dash
    b'\xe2\x80\x9c': b'"',
    b'\xe2\x80\x9d': b'"',
    b'\xe2\x80\x98': b"'",
    b'\xe2\x80\x99': b"'",
    b'\xe2\x80\xa6': b'...',
    b'\xc2\xb7': b'-',
    b'\xe2\x9c\x93': b'-',
    b'\xe2\x9c\x97': b'x',
    b'\xe2\x9a\xa1': b'!',
    b'\xe2\x98\x89': b'@',
    b'\xe2\x9c\x89': b'!',
    b'\xe2\x9c\x8f': b'?',
    b'\xe2\x96\xb6': b'>',
    b'\xe2\x96\x88': b'#',
    b'\xe2\x96\x91': b'.',
    b'\xe2\x97\x8b': b'o',
    b'\xe2\x97\x8c': b'o',
    b'\xe2\x97\x8f': b'*',
    b'\xe2\x97\x93': b'.',
    b'\xe2\x97\x94': b'.',
    b'\xe2\xac\x9b': b'>',
    b'\xe2\xac\x87': b'<',
    b'\xe2\x96\xba': b'>',
    b'\xe2\x96\xc4': b'<',
    b'\xe2\x96\xbe': b'>',
    b'\xe2\x97\x84': b'<',
    b'\xe2\xac\x9c': b'>',
    b'\xe2\x97\x86': b'#',
    b'\xe2\xac\xa1': b'+',
    b'\xe2\x97\xa1': b'.',
    b'\xe2\x97\xa2': b'.',
    b'\xe2\x97\xa3': b'#',
    b'\xe2\x9d\x96': b'-',
    b'\xe2\x9d\x9c': b'x',
    b'\xe2\x9d\xa4': b'<3',
    b'\xe2\xad\x95': b'*',
    b'\xe2\x96\xa0': b'#',
    b'\xe2\x96\xa1': b'.',
    b'\xe2\x9d\x96': b'-',
}
total_files = 0
total_bytes = 0
for dirpath, _, files in os.walk(root):
    for fn in files:
        if not fn.endswith(('.tsx', '.ts', '.js', '.jsx')):
            continue
        p = os.path.join(dirpath, fn)
        with open(p, 'rb') as f:
            d = f.read()
        before = sum(1 for b in d if b > 127)
        if before == 0:
            continue
        for old, new in mapping.items():
            d = d.replace(old, new)
        # Drop any remaining high bytes
        out = bytearray()
        for b in d:
            if b > 127:
                out.append(ord('?'))
            else:
                out.append(b)
        with open(p, 'wb') as f:
            f.write(bytes(out))
        total_files += 1
        total_bytes += before
print(f'Cleaned {total_files} files, {total_bytes} non-ASCII bytes replaced.')