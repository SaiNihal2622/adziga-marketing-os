p = r'src/app/app/orchestrate/page.tsx'
with open(p, 'rb') as f:
    d = f.read()
print('size:', len(d))
print('non-ascii count:', sum(1 for b in d if b > 127))
# find any non-ascii positions
count = 0
for i, b in enumerate(d):
    if b > 127:
        count += 1
        # find end of multi-byte sequence
        if b == 0xe2:  # likely start of multi-byte
            seq = d[i:i+3]
            try:
                decoded = seq.decode('utf-8')
            except:
                decoded = '???'
            print(f'pos {i}: bytes={b:02X} {seq.hex()} decoded="{decoded}"')
        if count > 20: break