import sys
p = r'C:\Users\saini\.minimax-agent\projects\adziga-system\prisma\schema.prisma'
with open(p, 'rb') as f:
    data = f.read()

# Replace non-UTF8-clean punctuation with ASCII
mapping = [
    (b'\xe2\x80\x94', b'-'),  # em-dash
    (b'\xe2\x80\x93', b'-'),  # en-dash
    (b'\xe2\x80\x9c', b'"'),  # left double quote
    (b'\xe2\x80\x9d', b'"'),  # right double quote
    (b'\xe2\x80\x98', b"'"),  # left single quote
    (b'\xe2\x80\x99', b"'"),  # right single quote
    (b'\xe2\x80\xa6', b'...'),  # ellipsis
    (b'\xc2\xb7', b'-'),  # middle dot
    (b'\xe2\x9c\x93', b'-'),  # check mark
    (b'\xe2\x9c\x97', b'x'),  # x mark
    (b'\xe2\x9a\xa1', b'!'),  # lightning
    (b'\xe2\x98\x89', b'@'),  # envelope
    (b'\xe2\x9c\x89', b'!'),  # pencil
    (b'\xe2\x9c\x8f', b'?'),  # question mark in box
    (b'\xe2\x96\xb6', b'>'),  # play
    (b'\xe2\x96\x88', b'#'),  # full block
    (b'\xe2\x96\x91', b'.'),  # light shade
    (b'\xe2\x97\x8b', b'o'),  # circle
    (b'\xe2\x97\x8c', b'o'),  # circle
    (b'\xe2\x97\x8f', b'*'),  # circle filled
    (b'\xe2\x97\x93', b'.'),  # dotted circle
    (b'\xe2\x97\x94', b'.'),  # circle vertical
    (b'\xe2\xac\x9b', b'>'),  # chevron
    (b'\xe2\xac\x87', b'<'),  # chevron
    (b'\xe2\x96\xba', b'>'),  # right-pointing pointer
    (b'\xe2\x96\xc4', b'<'),  # left-pointing pointer
    (b'\xe2\x96\xbe', b'>'),  # right open square
    (b'\xe2\x97\x84', b'<'),  # left open square
    (b'\xe2\xac\x9c', b'>'),  # right open square
    (b'\xe2\x97\x86', b'#'),  # diamond
    (b'\xe2\xac\xa1', b'+'),  # alt x
    (b'\xe2\x97\xa1', b'.'),  # white square
    (b'\xe2\x97\xa2', b'.'),  # white square
    (b'\xe2\x97\xa3', b'#'),  # white square filled
    (b'\xe2\x9d\x96', b'-'),  # minus
    (b'\xe2\x9d\x9c', b'x'),  # cross
    (b'\xe2\x9d\xa4', b'<3'),  # heart
    (b'\xe2\xad\x95', b'*'),  # circled vertical
    (b'\xe2\x96\xa0', b'#'),  # black square
    (b'\xe2\x96\xa1', b'.'),  # white square
]
for old, new in mapping:
    data = data.replace(old, new)

# Drop any remaining high bytes (replace with ?)
out = bytearray()
for b in data:
    if b > 127:
        out.append(ord('?'))
    else:
        out.append(b)

with open(p, 'wb') as f:
    f.write(bytes(out))

print('Cleaned.')
with open(p, 'rb') as f:
    d = f.read()
print('Last 5 bytes:', d[-5:])
print('Non-ASCII count:', sum(1 for b in d if b > 127))