@echo off
setlocal EnableDelayedExpansion
title ZY Player - Build Release APK

REM ==========================================================
REM  ZY Player - Android APK build script
REM  Chain: sync src - uni-app build - copy assets - gradle - output
REM  Usage: double click this file, or from cmd:
REM         build-apk.bat           normal incremental build
REM         build-apk.bat clean     wipe dist and gradle build first
REM ==========================================================

set "PROJ=%~dp0"
if "%PROJ:~-1%"=="\" set "PROJ=%PROJ:~0,-1%"
set "BUILD=%PROJ%\uni-cli-build"
set "SRC=%BUILD%\src"
set "DIST=%BUILD%\dist"
set "ANDROID=%PROJ%\android-package"
set "WWW=%ANDROID%\simpleDemo\src\main\assets\apps\__UNI__3C9920B\www"
set "APKSRC=%ANDROID%\simpleDemo\build\outputs\apk\release\simpleDemo-release.apk"
set "SASSL=%BUILD%\node_modules\@dcloudio\vue-cli-plugin-uni\packages\sass-loader\dist\webpackImporter.js"
set "UNILOG=%TEMP%\zyplayer_uni.log"
set "GRADLELOG=%TEMP%\zyplayer_gradle.log"

echo.
echo ==========================================================
echo   ZY Player  -  Android APK builder
echo ==========================================================
echo   Project : %PROJ%
echo ==========================================================
echo.

REM ---------- step 1 : toolchain ----------
echo [1/7] Checking toolchain ...
where node >nul 2>&1
if errorlevel 1 goto :no_node
where npm >nul 2>&1
if errorlevel 1 goto :no_node
if not defined JAVA_HOME if exist "C:\Java\jdk-17" set "JAVA_HOME=C:\Java\jdk-17"
if not defined JAVA_HOME goto :no_java
if not exist "%ANDROID%\gradlew.bat" goto :no_project
if not exist "%SRC%\manifest.json" goto :no_project
if not exist "%BUILD%\node_modules" goto :no_modules
echo   node / npm : ok
echo   JAVA_HOME  : %JAVA_HOME%
echo.

REM ---------- step 2 : sass-loader patch ----------
echo [2/7] Checking sass-loader patch ...
if not exist "%SASSL%" goto :no_modules
findstr /c:"toFileUri" "%SASSL%" >nul 2>&1
if not errorlevel 1 goto :patch_ok
echo   patch missing - restoring from patches\webpackImporter.js
copy /y "%BUILD%\patches\webpackImporter.js" "%SASSL%" >nul
if errorlevel 1 goto :patch_failed
echo   patch restored - ok
goto :patch_done
:patch_ok
echo   patch already applied - ok
:patch_done
echo.

REM ---------- step 3 : optional clean ----------
if /i "%~1"=="clean" goto :do_clean
echo [3/7] Clean skipped - pass clean as argument to wipe old output
goto :clean_done
:do_clean
echo [3/7] Cleaning previous build output ...
if exist "%DIST%" rmdir /s /q "%DIST%"
if exist "%ANDROID%\simpleDemo\build" rmdir /s /q "%ANDROID%\simpleDemo\build"
echo   done
:clean_done
echo.

REM ---------- step 4 : sync sources ----------
echo [4/7] Syncing sources into uni-cli-build\src ...
robocopy "%PROJ%" "%SRC%" App.vue main.js manifest.json pages.json uni.scss /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :sync_failed
robocopy "%PROJ%\pages" "%SRC%\pages" /MIR /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :sync_failed
robocopy "%PROJ%\static" "%SRC%\static" /MIR /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :sync_failed
robocopy "%PROJ%\utils" "%SRC%\utils" /MIR /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :sync_failed
echo   done
echo.

REM ---------- step 5 : uni-app build ----------
echo [5/7] Building front-end assets - about 1 to 2 minutes ...
set "NODE_OPTIONS=--openssl-legacy-provider"
pushd "%BUILD%"
call npm run build:app >"%UNILOG%" 2>&1
set "RC=!ERRORLEVEL!"
popd
if not "!RC!"=="0" goto :uni_failed
if not exist "%DIST%\app-view.js" goto :no_appview
for %%F in ("%DIST%\app-view.js") do set "AVSIZE=%%~zF"
if !AVSIZE! LSS 100000 goto :appview_small
echo   app-view.js = !AVSIZE! bytes - ok
echo.

REM ---------- step 6 : copy assets into android project ----------
echo [6/7] Copying assets into the android project ...
if not exist "%WWW%" mkdir "%WWW%"
robocopy "%DIST%" "%WWW%" /MIR /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :sync_failed
if not exist "%WWW%\app-view.js" goto :no_appview
echo   done
echo.

REM ---------- step 7 : gradle assemble ----------
echo [7/7] Assembling release APK with Gradle - about 2 minutes ...
pushd "%ANDROID%"
call gradlew.bat :simpleDemo:assembleRelease --no-daemon >"%GRADLELOG%" 2>&1
set "RC=!ERRORLEVEL!"
popd
if not "!RC!"=="0" goto :gradle_failed
if not exist "%APKSRC%" goto :no_apk
echo   BUILD SUCCESSFUL
echo.

REM ---------- output ----------
set "APPVER=0.0.0"
pushd "%PROJ%"
for /f "delims=" %%V in ('node -e "console.log(require('./manifest.json').versionName)" 2^>nul') do set "APPVER=%%V"
popd
set "OUT=%PROJ%\ZY-Player-%APPVER%-release.apk"
copy /y "%APKSRC%" "%OUT%" >nul
if errorlevel 1 goto :copy_failed
for %%F in ("%OUT%") do set "OUTSIZE=%%~zF"

echo ==========================================================
echo   DONE
echo ==========================================================
echo   Version : %APPVER%
echo   Size    : !OUTSIZE! bytes
echo   Output  : %OUT%
if not exist "D:\APK" goto :no_apkdir
copy /y "%OUT%" "D:\APK\" >nul
echo   Also in : D:\APK\ZY-Player-%APPVER%-release.apk
:no_apkdir
echo ==========================================================
echo.
echo   Reminder - uninstall the old version before installing.
echo.
pause
exit /b 0

REM ================= failure handlers =================
:no_node
echo.
echo [FAIL] node or npm was not found in PATH.
echo        Install Node.js, then open a new cmd window and retry.
goto :die

:no_java
echo.
echo [FAIL] JAVA_HOME is not set - Gradle needs a JDK 17.
echo        Expected location: C:\Java\jdk-17
goto :die

:no_project
echo.
echo [FAIL] Project layout is not what this script expects.
echo        Missing one of:
echo          %SRC%\manifest.json
echo          %ANDROID%\gradlew.bat
goto :die

:no_modules
echo.
echo [FAIL] uni-cli-build\node_modules is missing or incomplete.
echo        Fix it with:
echo          cd /d "%BUILD%"
echo          npm install
echo        Then run this script again - the sass patch is re-applied
echo        automatically from the patches folder.
goto :die

:patch_failed
echo.
echo [FAIL] Could not restore the sass-loader patch.
echo        Backup file expected at:
echo          %BUILD%\patches\webpackImporter.js
goto :die

:sync_failed
echo.
echo [FAIL] Copying files failed. Check free disk space and permissions.
goto :die

:uni_failed
echo.
echo [FAIL] The uni-app build failed. Full log:
echo        %UNILOG%
echo.
echo   ---- last 30 log lines ----
powershell -NoProfile -Command "Get-Content -LiteralPath $env:TEMP\zyplayer_uni.log -Tail 30"
goto :die

:no_appview
echo.
echo [FAIL] dist\app-view.js is missing after the build.
echo        This file is mandatory - without it the app hangs on the
echo        splash screen. Most common cause is the sass-loader patch
echo        not applied. Check node_modules and retry.
goto :die

:appview_small
echo.
echo [FAIL] dist\app-view.js is too small: !AVSIZE! bytes, expected about 180000.
echo        The build was incomplete. Try: build-apk.bat clean
goto :die

:gradle_failed
echo.
echo [FAIL] Gradle assembleRelease failed. Full log:
echo        %GRADLELOG%
echo.
echo   ---- last 30 log lines ----
powershell -NoProfile -Command "Get-Content -LiteralPath $env:TEMP\zyplayer_gradle.log -Tail 30"
goto :die

:no_apk
echo.
echo [FAIL] Gradle reported success but the APK is not there:
echo        %APKSRC%
goto :die

:copy_failed
echo.
echo [FAIL] Could not copy the APK to the project folder.
goto :die

:die
echo.
echo Build aborted.
echo.
pause
exit /b 1
