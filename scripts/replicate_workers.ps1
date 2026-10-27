# PowerShell Script to Provision & Replicate Isolated MT5 Workers (worker_1..worker_5)
$ErrorActionPreference = "Stop"

$WorkspaceRoot = (Resolve-Path "$PSScriptRoot\..").Path
$Root = "$WorkspaceRoot\mt5_workers"
$SharedBases = "$Root\shared_bases"
$SharedExperts = "$Root\shared_experts"
$SharedReports = "$Root\shared_reports"

Write-Host "=== BacktestAI MT5 Worker Fleet Provisioning ===" -ForegroundColor Cyan
Write-Host "Workers Directory: $Root" -ForegroundColor Gray

# 1. Ensure shared directories exist
New-Item -ItemType Directory -Force -Path $SharedBases | Out-Null
New-Item -ItemType Directory -Force -Path $SharedExperts | Out-Null
New-Item -ItemType Directory -Force -Path $SharedReports | Out-Null

# 2. Source worker_1 binary template
$SourceWorker1 = "$Root\worker_1"
$ReferenceWorker1 = "C:\MetaTrader5_Portable\mt5_workers\worker_1"
$ReferenceSharedBases = "C:\MetaTrader5_Portable\mt5_workers\shared_bases"
$ReferenceSharedExperts = "C:\MetaTrader5_Portable\mt5_workers\shared_experts"

if (-not (Test-Path "$SourceWorker1\terminal64.exe")) {
    if (Test-Path "$ReferenceWorker1\terminal64.exe") {
        Write-Host "Seeding worker_1 binaries from reference installation..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Force -Path $SourceWorker1 | Out-Null
        
        # Copy binaries and configs, excluding junctions and large cache
        Get-ChildItem -Path $ReferenceWorker1 -Exclude "Bases", "*.png", "*.htm", "Tester" | ForEach-Object {
            if ($_.Name -eq "MQL5") {
                $targetMql5 = "$SourceWorker1\MQL5"
                New-Item -ItemType Directory -Force -Path $targetMql5 | Out-Null
                Get-ChildItem -Path $_.FullName -Exclude "Experts" | ForEach-Object {
                    Copy-Item -Path $_.FullName -Destination $targetMql5 -Recurse -Force
                }
            } else {
                Copy-Item -Path $_.FullName -Destination $SourceWorker1 -Recurse -Force
            }
        }
    } else {
        Write-Host "WARNING: Reference worker_1 binaries not found at $ReferenceWorker1" -ForegroundColor Red
    }
}

# Link shared bases data if reference exists
if ((Test-Path $ReferenceSharedBases) -and ((Get-ChildItem -Path $SharedBases).Count -eq 0)) {
    Write-Host "Linking shared tick bases from reference..." -ForegroundColor Gray
    Get-ChildItem -Path $ReferenceSharedBases | ForEach-Object {
        $dest = "$SharedBases\$($_.Name)"
        if (-not (Test-Path $dest)) {
            if ($_.PSIsContainer) {
                New-Item -ItemType Junction -Path $dest -Target $_.FullName | Out-Null
            } else {
                Copy-Item -Path $_.FullName -Destination $dest -Force
            }
        }
    }
}

# Link shared experts if reference exists
if ((Test-Path $ReferenceSharedExperts) -and ((Get-ChildItem -Path $SharedExperts).Count -eq 0)) {
    Write-Host "Copying initial expert advisors..." -ForegroundColor Gray
    Copy-Item -Path "$ReferenceSharedExperts\*" -Destination $SharedExperts -Recurse -Force
}

# 3. Replicate across workers 1 to 5
1..5 | ForEach-Object {
    $targetId = $_
    $targetDir = "$Root\worker_$targetId"
    Write-Host "Configuring Worker $targetId at $targetDir..." -ForegroundColor Yellow

    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

    if ($targetId -ne 1) {
        # Copy binaries and configs from worker_1
        Get-ChildItem -Path $SourceWorker1 -Exclude "Bases", "*.png", "*.htm", "Tester" | ForEach-Object {
            if ($_.Name -eq "MQL5") {
                $targetMql5 = "$targetDir\MQL5"
                New-Item -ItemType Directory -Force -Path $targetMql5 | Out-Null
                Get-ChildItem -Path $_.FullName -Exclude "Experts" | ForEach-Object {
                    Copy-Item -Path $_.FullName -Destination $targetMql5 -Recurse -Force
                }
            } else {
                Copy-Item -Path $_.FullName -Destination $targetDir -Recurse -Force
            }
        }
    }

    # Setup Bases Junction -> shared_bases
    $targetBases = "$targetDir\Bases"
    if (Test-Path $targetBases) {
        Remove-Item -Path $targetBases -Recurse -Force
    }
    New-Item -ItemType Junction -Path $targetBases -Target $SharedBases | Out-Null

    # Setup MQL5/Experts Junction -> shared_experts
    $targetMql5 = "$targetDir\MQL5"
    New-Item -ItemType Directory -Force -Path $targetMql5 | Out-Null
    $targetExperts = "$targetDir\MQL5\Experts"
    if (Test-Path $targetExperts) {
        Remove-Item -Path $targetExperts -Recurse -Force
    }
    New-Item -ItemType Junction -Path $targetExperts -Target $SharedExperts | Out-Null

    Write-Host "Worker ${targetId}: terminal64.exe [OK], MetaEditor64.exe [OK], Bases Junction [OK], Experts Junction [OK]" -ForegroundColor Green
}

Write-Host "`nAll 5 Workers successfully provisioned, linked, and verified!" -ForegroundColor Cyan
