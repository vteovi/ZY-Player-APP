import time

CMD = "C:\\Windows\\System32\\cmd.exe"

import subprocess


def cpu():
    p = subprocess.run(
        [CMD, "/c", 'powershell -NoProfile -Command "Get-Process node,java -ErrorAction SilentlyContinue | Select-Object Id,CPU,WS | Format-Table -HideTableHeaders"'],
        capture_output=True, text=True, errors="replace", stdin=subprocess.DEVNULL,
    )
    return [l.strip() for l in (p.stdout or "").splitlines() if l.strip()]


a = cpu()
print("--- sample 1 ---")
for l in a:
    print(l)
time.sleep(8)
b = cpu()
print("--- sample 2 (8s later) ---")
for l in b:
    print(l)

print()
print("--- delta ---")
da = {}
for l in a:
    parts = l.split()
    if len(parts) >= 3:
        da[parts[0]] = float(parts[1])
for l in b:
    parts = l.split()
    if len(parts) >= 3 and parts[0] in da:
        print("pid %s  cpu +%.1fs  ws=%s" % (parts[0], float(parts[1]) - da[parts[0]], parts[2]))
