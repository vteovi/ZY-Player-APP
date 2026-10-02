import io
import os
import sys

TARGET = sys.argv[1]

with open(TARGET, "rb") as f:
    raw = f.read()

errors = []

# 1. ASCII only
bad = [(i, b) for i, b in enumerate(raw) if b > 127]
if bad:
    errors.append("non-ASCII bytes: %d, first at %s" % (len(bad), bad[:5]))

# 2. CRLF everywhere (no bare LF, no bare CR)
lf_only = 0
cr_only = 0
for i, b in enumerate(raw):
    if b == 0x0A and (i == 0 or raw[i - 1] != 0x0D):
        lf_only += 1
    if b == 0x0D and (i + 1 >= len(raw) or raw[i + 1] != 0x0A):
        cr_only += 1
if lf_only:
    errors.append("bare LF count: %d" % lf_only)
if cr_only:
    errors.append("bare CR count: %d" % cr_only)

text = raw.decode("ascii", "replace")
lines = text.replace("\r\n", "\n").split("\n")

# 3. labels must not sit inside a paren block; paren depth must close to 0
depth = 0
labels = []
for n, line in enumerate(lines, 1):
    s = line.strip()
    low = s.lower()
    if low.startswith("rem "):
        continue
    if s.startswith(":"):
        if depth != 0:
            errors.append("label at line %d is inside paren block, depth=%d: %s" % (n, depth, s))
        labels.append((n, s))
    # strip quoted segments so parens inside quotes don't count
    stripped = []
    inq = False
    for ch in line:
        if ch == '"':
            inq = not inq
            continue
        if not inq:
            stripped.append(ch)
    for ch in stripped:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth < 0:
                errors.append("line %d: unbalanced closing paren" % n)
                depth = 0

if depth != 0:
    errors.append("final paren depth = %d, expected 0" % depth)

print("file      :", TARGET)
print("bytes     :", len(raw))
print("lines     :", len(lines))
print("labels    :", len(labels))
for n, s in labels:
    print("   %4d  %s" % (n, s))
print()
if errors:
    print("RESULT: FAIL")
    for e in errors:
        print("  -", e)
    sys.exit(1)
print("RESULT: PASS  (ascii-only, CRLF, labels top-level, parens balanced)")
