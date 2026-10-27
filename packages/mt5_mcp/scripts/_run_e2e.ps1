param()
$ErrorActionPreference = "Stop"
# Strip inherited PYTHONPATH (points at Hermes venv → pydantic_core conflict)
if ($env:PYTHONPATH) { Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue }
$env:PYTHONDONTWRITEBYTECODE = "1"
$python = "C:\AI\MT5_MCP\MT5-MCP-main\.venv\Scripts\python.exe"
$script = "C:\AI\MT5_MCP\MT5-MCP-main\scripts\test_mcp_e2e.py"
& $python $script 2>&1 | Select-String -Pattern '===|login:|server:|balance:|EA count:|ex5_exists|success|ERROR' | ForEach-Object { $_.Line }
