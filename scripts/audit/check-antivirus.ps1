$ErrorActionPreference = 'Stop'
# Read-only gate: never alter protection, exclusions, quarantine or remediation.
$taskAuditRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$taskStatus = Get-MpComputerStatus
$taskThreats = @(Get-MpThreat)
$taskDetections = @(Get-MpThreatDetection)
$taskProviders = @(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntivirusProduct)
$taskPattern = [regex]::Escape($taskAuditRoot) + '|mars-pathfinder|pymupdf|pyogrio|esbuild|rolldown|next[\\/].*swc|typescript|tsc\.exe|node\.exe|python\.exe|playwright|vitest|shapely|rasterio|gdal|onnxruntime|numpy|scipy|pyproj'
$taskSince = (Get-Date).AddDays(-30)
try {
  $taskEvents = @(Get-WinEvent -FilterHashtable @{ LogName='Microsoft-Windows-Windows Defender/Operational'; Id=1116,1117,1118,1119,1121; StartTime=$taskSince })
} catch {
  if ($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') { $taskEvents = @() } else { throw }
}
$taskRelatedEvents = @($taskEvents | Where-Object { $_.Message -match $taskPattern })
$taskRelatedThreats = @($taskThreats | Where-Object { ($_.Resources -join ' ') -match $taskPattern })
$taskRelatedDetections = @($taskDetections | Where-Object { ($_.Resources -join ' ') -match $taskPattern })
# Any matching event needs explicit reconciliation/review; don't infer a false positive.
$taskReview = @($taskRelatedThreats | Where-Object IsActive).Count -gt 0 -or @($taskRelatedDetections | Where-Object { -not $_.ActionSuccess }).Count -gt 0 -or $taskRelatedEvents.Count -gt 0
$taskReport = [ordered]@{
  checkedAtUtc=(Get-Date).ToUniversalTime().ToString('o')
  mode='Read-only status/history; not a fresh full malware scan'
  antivirusEnabled=$taskStatus.AntivirusEnabled
  realTimeProtectionEnabled=$taskStatus.RealTimeProtectionEnabled
  signatureUpdated=$taskStatus.AntivirusSignatureLastUpdated.ToUniversalTime().ToString('o')
  providers=@($taskProviders | ForEach-Object displayName)
  reportedThreatCount=$taskThreats.Count
  activeThreatCount=@($taskThreats | Where-Object IsActive).Count
  reportedDetectionCount=$taskDetections.Count
  projectRelatedThreatCount=$taskRelatedThreats.Count
  projectRelatedDetectionCount=$taskRelatedDetections.Count
  eventHistorySinceUtc=$taskSince.ToUniversalTime().ToString('o')
  eventsInspected=$taskEvents.Count
  projectRelatedEvents=@($taskRelatedEvents | Select-Object Id,TimeCreated,Message)
  reviewRequired=$taskReview
}
$taskReportDirectory = Join-Path $taskAuditRoot 'docs/final-audit'
New-Item -ItemType Directory -Path $taskReportDirectory -Force | Out-Null
$taskReportJson = $taskReport | ConvertTo-Json -Depth 7
[IO.File]::WriteAllText((Join-Path $taskReportDirectory 'antivirus.json'), $taskReportJson, [Text.UTF8Encoding]::new($false))
$taskReportJson
if ($taskReview) { throw 'STOP: Project-related antivirus history requires review before any execution.' }
