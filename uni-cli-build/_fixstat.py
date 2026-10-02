import re

FILES = [
    r"D:\WorkBuddy\ZY-Player-APP-main\manifest.json",
    r"D:\WorkBuddy\ZY-Player-APP-main\uni-cli-build\src\manifest.json",
]

PAT = '            "enable" : true'

for f in FILES:
    with open(f, "r", encoding="utf-8") as fh:
        txt = fh.read()
    n = txt.count(PAT)
    print("%s   occurrences with 12-space indent: %d" % (f, n))
    if n == 1:
        txt = txt.replace(PAT, '            "enable" : false')
        with open(f, "w", encoding="utf-8", newline="") as fh:
            fh.write(txt)
        print("   -> patched uniStatistics.enable = false")
    else:
        print("   -> SKIPPED, unexpected occurrence count")

print()
for f in FILES:
    with open(f, "r", encoding="utf-8") as fh:
        for i, line in enumerate(fh.read().splitlines(), 1):
            if "uniStatistics" in line or '"enable"' in line:
                print("%s:%d: %s" % (f.split("\\")[-2], i, line))
