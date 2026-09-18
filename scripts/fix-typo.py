p = r'src/lib/format.ts'
with open(p, 'rb') as f:
    d = f.read()
d = d.replace(b'?: n INR 0', b'?: (n ?? 0))')
d = d.replace(b': n INR 0', b': (n ?? 0))')
d = d.replace(b'? n INR 0', b'? (n ?? 0))')
d = d.replace(b'n INR 0', b'(n ?? 0)')
d = d.replace(b'INR 0', b'(?? 0)')
with open(p, 'wb') as f:
    f.write(d)
print('done')