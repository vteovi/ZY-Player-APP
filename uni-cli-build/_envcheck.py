import subprocess

CMD = "C:\\Windows\\System32\\cmd.exe"


def run(line):
    p = subprocess.run(
        [CMD, "/c", line],
        capture_output=True,
        text=True,
        errors="replace",
        stdin=subprocess.DEVNULL,
    )
    return p.returncode, (p.stdout or "").strip(), (p.stderr or "").strip()


for line in [
    "where node",
    "where npx",
    'node -v',
    "where java",
    'echo JAVA_HOME=%JAVA_HOME%',
    'echo ANDROID_HOME=%ANDROID_HOME%',
    'if exist "D:\\APK" (echo APKDIR_YES) else (echo APKDIR_NO)',
]:
    rc, out, err = run(line)
    print("--- %s  rc=%s" % (line, rc))
    print(out)
    if err:
        print("ERR:", err)
