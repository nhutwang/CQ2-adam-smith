@echo off
setlocal EnableExtensions
rem ---------------------------------------------------------------------------
rem  Chay web "Ban tay vo hinh / ban tay huu hinh" (render day du qua HTTP server).
rem  Dung: nhay dup file nay, hoac:  chay-web.cmd 8080
rem  Can: Python 3 (hoac Node.js) va Internet (three.js, GSAP, Lenis, Google Fonts qua CDN).
rem ---------------------------------------------------------------------------
set "PORT=%~1"
if "%PORT%"=="" set "PORT=8080"
set "SITE=%~dp0ban-tay-web"

if not exist "%SITE%\index.html" (
  echo [LOI] Khong thay "%SITE%\index.html"
  echo       Hay giai nen day du repo, giu thu muc ban-tay-web nam canh file nay.
  pause
  exit /b 1
)

rem --- Tim Python 3 that su: "python" trong WindowsApps co the chi la loi tat mo Microsoft Store ---
set "PY="
python -c "import http.server" >nul 2>nul && set "PY=python"
if not defined PY (py -3 -c "import http.server" >nul 2>nul && set "PY=py -3")
if not defined PY (
  where npx >nul 2>nul
  if errorlevel 1 (
    echo [LOI] Khong tim thay Python 3 hoac Node.js tren may.
    echo       Cai Python tai https://www.python.org/downloads/ va tick "Add python.exe to PATH",
    echo       sau do chay lai file nay.
    pause
    exit /b 1
  )
)

rem --- Chon cong con trong: tren Windows, Python van mo duoc cong dang bi app khac chiem ---
set "HASPS="
where powershell >nul 2>nul && set "HASPS=1"
if not defined HASPS goto portok
set /a TRIES=0
:findport
powershell -NoProfile -Command "try { foreach ($a in [Net.IPAddress]::Loopback, [Net.IPAddress]::Any) { $l = [Net.Sockets.TcpListener]::new($a, %PORT%); $l.Start(); $l.Stop() }; exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto portok
set /a TRIES+=1
if %TRIES% GEQ 20 goto portok
echo Cong %PORT% dang bi ung dung khac su dung, thu cong tiep theo...
set /a PORT+=1
goto findport
:portok

set "URL=http://127.0.0.1:%PORT%/index.html"
echo.
echo Dang khoi chay HTTP Server tai: %SITE%
echo Dia chi trinh duyet: %URL%
echo.
echo Luu y:
echo  - Can co ket noi Internet de tai three.js, GSAP, Lenis, Google Fonts tu CDN.
echo  - Dong cua so nay hoac an Ctrl+C de tat server.
echo.

rem --- Mo trinh duyet ngay khi server san sang ---
if defined HASPS (
  start "" /b powershell -NoProfile -Command "for ($i = 0; $i -lt 120; $i++) { try { [Net.Sockets.TcpClient]::new('127.0.0.1', %PORT%).Close(); break } catch { Start-Sleep -Milliseconds 500 } }; Start-Process '%URL%'"
) else (
  start "" "%URL%"
)

rem --- Chay server; ep MIME .js = text/javascript de trinh duyet khong chan ES module ---
if defined PY (
  cd /d "%SITE%"
  %PY% -c "import http.server as h; H = h.SimpleHTTPRequestHandler; H.extensions_map.update({'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml'}); h.test(HandlerClass=H, port=%PORT%, bind='127.0.0.1')"
) else (
  echo Khong co Python, dung Node.js: npx http-server
  call npx --yes http-server "%SITE%" -p %PORT% -a 127.0.0.1 -c-1
)
if errorlevel 1 (
  echo.
  echo [LOI] Server da dung voi loi, xem thong bao phia tren.
  pause
)
endlocal
