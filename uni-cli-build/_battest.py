import os
import shutil
import subprocess
import sys

CMD = "C:\\Windows\\System32\\cmd.exe"
REAL_BAT = r"D:\WorkBuddy\ZY-Player-APP-main\build-apk.bat"
TMP = os.path.join(os.environ["TEMP"], "battest")
PROJ = os.path.join(TMP, "proj")

STUB_UNI = """@echo off
if not exist "%~1" mkdir "%~1"
node -e "require('fs').writeFileSync(process.argv[1],Buffer.alloc(200000,65))" "%~1\\app-view.js"
if not exist "%~1\\app-service.js" node -e "require('fs').writeFileSync(process.argv[1],Buffer.alloc(2000,66))" "%~1\\app-service.js"
echo STUB uni build ok
exit /b 0
"""

STUB_GRADLE = """@echo off
set "APK=%~1"
set "RES=%~2"
for %%A in ("%APK%") do set "D=%%~dpA"
if "%D:~-1%"=="\\" set "D=%D:~0,-1%"
if not exist "%D%" mkdir "%D%"
node -e "require('fs').writeFileSync(process.argv[1],Buffer.alloc(1000,66))" "%APK%"
echo STUB gradle run
if not "%RES%"=="0" echo FAILURE: fake gradle error
exit /b %RES%
"""

SASSL_REL = r"uni-cli-build\node_modules\@dcloudio\vue-cli-plugin-uni\packages\sass-loader\dist\webpackImporter.js"


def w(path, text, binary=False):
    d = os.path.dirname(path)
    if d and not os.path.isdir(d):
        os.makedirs(d)
    mode = "wb" if binary else "w"
    kwargs = {} if binary else {"encoding": "ascii", "newline": "\r\n"}
    with open(path, mode, **kwargs) as f:
        f.write(text)


def setup(patched=True, tiny_appview=False):
    if os.path.isdir(TMP):
        shutil.rmtree(TMP)
    # fake project skeleton
    w(os.path.join(PROJ, "manifest.json"), '{"versionName":"0.2.0","versionCode":200}')
    for f in ["App.vue", "main.js", "uni.scss"]:
        w(os.path.join(PROJ, f), "// fake")
    w(os.path.join(PROJ, "pages.json"), "{}")
    w(os.path.join(PROJ, "pages", "film", "film.vue"), "<template></template>")
    w(os.path.join(PROJ, "static", "images", "a.png"), "png")
    w(os.path.join(PROJ, "utils", "database.js"), "// fake")
    w(os.path.join(PROJ, "uni-cli-build", "package.json"), '{"name":"x"}')
    w(os.path.join(PROJ, "uni-cli-build", "src", "manifest.json"), '{"versionName":"0.2.0"}')
    os.makedirs(os.path.join(PROJ, "uni-cli-build", "node_modules"), exist_ok=True)

    # sass-loader file: unpatched vs patched
    if patched:
        body = "// original\nvar _path = require('path');\nconst toFileUri = (p) => p\n"
        w(os.path.join(PROJ, "uni-cli-build", "patches", "webpackImporter.js"),
          "// [patch] backup\nconst toFileUri = (p) => p\n")
    else:
        body = "// original\nvar _path = require('path');\n"
        w(os.path.join(PROJ, "uni-cli-build", "patches", "webpackImporter.js"),
          "// [patch] backup\nconst toFileUri = (p) => p\n")
    w(os.path.join(PROJ, SASSL_REL), body)

    w(os.path.join(PROJ, "android-package", "gradlew.bat"), "@echo off\r\nexit /b 0\r\n")
    os.makedirs(os.path.join(PROJ, "android-package", "simpleDemo", "src", "main",
                             "assets", "apps", "__UNI__3C9920B", "www"), exist_ok=True)

    # stubs
    w(os.path.join(TMP, "stub_uni.bat"), STUB_UNI)
    w(os.path.join(TMP, "stub_gradle.bat"), STUB_GRADLE)

    # copy + patch the real bat
    with open(REAL_BAT, "r", encoding="ascii") as f:
        txt = f.read()
    o1 = 'call npm run build:app >"%UNILOG%" 2>&1'
    n1 = 'call "%s\\stub_uni.bat" "%s" >"%%UNILOG%%" 2>&1' % (TMP, "%DIST%")
    assert o1 in txt, "npm line not found"
    txt = txt.replace(o1, n1)
    if tiny_appview:
        txt = txt.replace("Buffer.alloc(200000", "Buffer.alloc(200000")
    return txt


def run(txt, gradle_rc="0"):
    txt = txt.replace(
        'call gradlew.bat :simpleDemo:assembleRelease --no-daemon >"%GRADLELOG%" 2>&1',
        'call "%s\\stub_gradle.bat" "%%APKSRC%%" %s >"%%GRADLELOG%%" 2>&1' % (TMP, gradle_rc),
    )
    bat = os.path.join(PROJ, "build-apk.bat")
    with open(bat, "w", encoding="ascii", newline="\r\n") as f:
        f.write(txt)
    p = subprocess.run([CMD, "/c", bat], capture_output=True, text=True,
                       errors="replace", stdin=subprocess.DEVNULL, cwd=TMP)
    return p.returncode, (p.stdout or ""), (p.stderr or "")


def banner(t):
    print("\n" + "=" * 62)
    print(t)
    print("=" * 62)


def show(out, tail=45):
    lines = out.rstrip().splitlines()
    for ln in lines[-tail:]:
        print("   |", ln)


# ---------------- test A : happy path ----------------
banner("TEST A  happy path")
txt = setup(patched=True)
rc, out, err = run(txt, gradle_rc="0")
show(out)
print(">>> exit =", rc)
apk = os.path.join(PROJ, "ZY-Player-0.2.0-release.apk")
print(">>> output apk exists:", os.path.isfile(apk), os.path.getsize(apk) if os.path.isfile(apk) else "-")
www = os.path.join(PROJ, "android-package", "simpleDemo", "src", "main", "assets",
                   "apps", "__UNI__3C9920B", "www")
print(">>> www has app-view.js:", os.path.isfile(os.path.join(www, "app-view.js")))
print(">>> src synced film.vue:", os.path.isfile(os.path.join(PROJ, "uni-cli-build", "src", "pages", "film", "film.vue")))
print(">>> RESULT:", "PASS" if rc == 0 and os.path.isfile(apk) else "FAIL")
if err.strip():
    print(">>> stderr:", err.strip()[:400])

# ---------------- test B : sass patch auto-restore ----------------
banner("TEST B  sass patch missing -> auto restore")
txt = setup(patched=False)
rc, out, err = run(txt, gradle_rc="0")
show(out, 30)
target = os.path.join(PROJ, SASSL_REL)
restored = "toFileUri" in open(target, encoding="ascii").read()
print(">>> patch restored in node_modules:", restored)
print(">>> RESULT:", "PASS" if restored and rc == 0 else "FAIL")

# ---------------- test C : app-view.js too small ----------------
banner("TEST C  app-view.js too small -> abort")
txt = setup(patched=True)
# make the stub write a tiny app-view.js
txt = txt.replace('call "%s\\stub_uni.bat"' % TMP, 'call "%s\\stub_small.bat"' % TMP)
w(os.path.join(TMP, "stub_small.bat"), """@echo off
if not exist "%~1" mkdir "%~1"
node -e "require('fs').writeFileSync(process.argv[1],Buffer.alloc(500,65))" "%~1\\app-view.js"
exit /b 0
""")
rc, out, err = run(txt, gradle_rc="0")
show(out, 22)
hit = "too small" in out
print(">>> hit small-file guard:", hit)
print(">>> apk wrongly produced:", os.path.isfile(os.path.join(PROJ, "ZY-Player-0.2.0-release.apk")))
print(">>> RESULT:", "PASS" if hit and rc == 1 else "FAIL")

# ---------------- test D : gradle failure ----------------
banner("TEST D  gradle returns 1 -> abort with log tail")
txt = setup(patched=True)
rc, out, err = run(txt, gradle_rc="1")
show(out, 25)
hit = "Gradle assembleRelease failed" in out
print(">>> hit gradle-failed handler:", hit)
print(">>> RESULT:", "PASS" if hit and rc == 1 else "FAIL")

# ---------------- test E : missing node_modules ----------------
banner("TEST E  node_modules missing -> clear message")
txt = setup(patched=True)
shutil.rmtree(os.path.join(PROJ, "uni-cli-build", "node_modules"))
rc, out, err = run(txt, gradle_rc="0")
show(out, 22)
hit = "node_modules is missing" in out
print(">>> hit no_modules handler:", hit)
print(">>> RESULT:", "PASS" if hit and rc == 1 else "FAIL")

print("\nALL TESTS DONE")
