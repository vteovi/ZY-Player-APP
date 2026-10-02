import subprocess
import sys

BAT = r"D:\WorkBuddy\ZY-Player-APP-main\build-apk.bat"
p = subprocess.run(
    ["C:\\Windows\\System32\\cmd.exe", "/c", BAT],
    capture_output=True,
    text=True,
    errors="replace",
    stdin=subprocess.DEVNULL,
    cwd=r"D:\WorkBuddy\ZY-Player-APP-main",
)
out = (p.stdout or "").replace("\r\n", "\n")
err = (p.stderr or "").replace("\r\n", "\n")
sys.stdout.write(out)
if err.strip():
    sys.stdout.write("\n--- STDERR ---\n" + err)
sys.stdout.write("\n=== EXIT=%s ===\n" % p.returncode)
