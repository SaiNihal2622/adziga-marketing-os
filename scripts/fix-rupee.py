p = r'src/lib/format.ts'
with open(p, 'rb') as f:
    d = f.read()

# Try multiple replacement strategies
d = d.replace(b'\xe2\x82\xb9', b'INR ')
d = d.replace(b'? ? ?', b'INR ')
d = d.replace(b'???', b'INR ')
d = d.replace(b'??', b'INR')

with open(p, 'wb') as f:
    f.write(d)
print('done')