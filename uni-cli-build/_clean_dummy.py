import os

p = r"D:\APK\ZY-Player-0.2.0-release.apk"
if os.path.isfile(p):
    size = os.path.getsize(p)
    if size == 1000:
        os.remove(p)
        print("removed test dummy:", p)
    else:
        print("NOT removed - unexpected size:", size)
else:
    print("absent:", p)
print("exists now:", os.path.isfile(p))
