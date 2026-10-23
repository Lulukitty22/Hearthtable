@echo off
rem Builds "Hearthtable Launcher.exe" in the repository root with the C# compiler that ships
rem with Windows (.NET Framework 4). No install needed. The exe is not committed; rebuild it here.
cd /d "%~dp0"
"%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe" -nologo -target:winexe -optimize ^
  -out:"..\..\Hearthtable Launcher.exe" -r:System.Windows.Forms.dll -r:System.Drawing.dll -r:System.Core.dll ^
  HearthtableLauncher.cs
if errorlevel 1 (echo Build failed.& pause & exit /b 1)
echo Built "Hearthtable Launcher.exe".
