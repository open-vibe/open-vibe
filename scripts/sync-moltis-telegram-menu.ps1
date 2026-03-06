param(
  [Parameter(Mandatory = $true)]
  [string]$Token
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Token)) {
  throw "Token is required."
}

$commands = @(
  @{ command = "new"; description = "Start a new session" },
  @{ command = "sessions"; description = "List and switch sessions" },
  @{ command = "model"; description = "Switch provider/model" },
  @{ command = "sandbox"; description = "Toggle sandbox mode" },
  @{ command = "sh"; description = "Enable shell command mode" },
  @{ command = "clear"; description = "Clear session history" },
  @{ command = "compact"; description = "Compact session context" },
  @{ command = "context"; description = "Show session context info" },
  @{ command = "help"; description = "Show Moltis help" },
  @{ command = "ov_help"; description = "Show OpenVibe command menu" },
  @{ command = "ov_mode"; description = "Switch OpenVibe bridge mode" },
  @{ command = "ov_relay"; description = "Bind Telegram chat to a thread" },
  @{ command = "ov_thread"; description = "Open or focus OpenVibe thread" },
  @{ command = "ov_workspace"; description = "List or open OpenVibe workspace" },
  @{ command = "ov_settings"; description = "Read or update OpenVibe settings" }
)

$body = @{
  commands = $commands
} | ConvertTo-Json -Depth 5

$url = "https://api.telegram.org/bot$Token/setMyCommands"
$response = Invoke-RestMethod -Method Post -Uri $url -ContentType "application/json" -Body $body

if (-not $response.ok) {
  throw "setMyCommands failed: $($response | ConvertTo-Json -Depth 8)"
}

Write-Host "Telegram menu synced: $($commands.Count) commands."
