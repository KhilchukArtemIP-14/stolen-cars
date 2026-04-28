@echo off
setlocal enabledelayedexpansion

set "PROJECT_DIR=%~1"
if "%PROJECT_DIR%"=="" set "PROJECT_DIR=."

echo Analyzing project: %PROJECT_DIR%
echo ================================

:: Count files (excluding node_modules, .git, dist, build, __pycache__)
set "FILE_COUNT=0"
for /f "delims=" %%F in ('dir /s /b "%PROJECT_DIR%" 2^>nul ^| findstr /v /i /l /c:"\\node_modules\\" /c:"\\.git\\" /c:"\\dist\\" /c:"\\build\\" /c:"\\__pycache__\\" /c:"\\.cache\\"') do (
    set /a FILE_COUNT+=1
)

echo File count: %FILE_COUNT%

:: Count lines of code (common extensions)
set "LINE_COUNT=0"
set "EXTENSIONS=.js .ts .py .java .go .rs .c .cpp .h .hpp .cs .rb .php .html .css .hbs .json .yaml .yml .md"

for /f "tokens=*" %%F in ('dir /s /b "%PROJECT_DIR%" 2^>nul') do (
    set "FILE=%%F"
    :: Check if file has one of the extensions
    set "MATCH=0"
    for %%X in (%EXTENSIONS%) do (
        if /i "!FILE:~-%%X!"=="%%X" set "MATCH=1"
    )
    if "!MATCH!"=="1" (
        for /f "tokens=3 delims=:" %%L in ('findstr /R /N "^" "%%F" 2^>nul ^| findstr /R "^[0-9]"') do (
            set /a LINE_COUNT+=1
        )
    )
)

echo Line count: %LINE_COUNT%

:: Qualification limits
set "MIN_FILES=3"
set "MAX_FILES=50"
set "MIN_LINES=200"
set "MAX_LINES=10000"

echo.
echo Qualification requirements:
echo   Files: %MIN_FILES% - %MAX_FILES%    → Current: %FILE_COUNT%
echo   Lines: %MIN_LINES% - %MAX_LINES%   → Current: %LINE_COUNT%
echo.

if %FILE_COUNT% LSS %MIN_FILES% (
    echo WARNING: Too few files (need at least %MIN_FILES%)
) else if %FILE_COUNT% GTR %MAX_FILES% (
    echo WARNING: Too many files (max %MAX_FILES%)
) else (
    echo File count is within limits.
)

if %LINE_COUNT% LSS %MIN_LINES% (
    echo WARNING: Too few lines of code (need at least %MIN_LINES%)
) else if %LINE_COUNT% GTR %MAX_LINES% (
    echo WARNING: Too many lines of code (max %MAX_LINES%)
) else (
    echo Line count is within limits.
)

endlocal