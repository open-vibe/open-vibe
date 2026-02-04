param(
  [string]$PublishDir = "publish",
  [string]$AnchorCommit = "bd150942aecf38392ebd715794b7be9ac239112c",
  [string]$SourceBranch = "main",
  [string]$RemoteUrl = "https://github.com/open-vibe/open-vibe",
  [string]$RemoteName = "origin",
  [string]$RemoteBranch = "main",
  [switch]$Push
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Git {
  param(
    [Parameter(Mandatory = $true)][string]$Cwd,
    [Parameter(Mandatory = $true)][string[]]$Args,
    [switch]$AllowFail
  )

  $output = & git -C $Cwd @Args 2>&1
  $exitCode = $LASTEXITCODE
  if (-not $AllowFail -and $exitCode -ne 0) {
    $joined = ($Args -join " ")
    $message = ($output | Out-String).Trim()
    throw "git -C $Cwd $joined failed ($exitCode): $message"
  }
  return ($output | Out-String).Trim()
}

function Ensure-Remote {
  param(
    [Parameter(Mandatory = $true)][string]$RepoDir,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Url
  )

  $existing = Invoke-Git -Cwd $RepoDir -Args @("remote") -AllowFail
  $remotes = @()
  if (-not [string]::IsNullOrWhiteSpace($existing)) {
    $remotes = $existing -split "`r?`n"
  }
  if ($remotes -contains $Name) {
    Invoke-Git -Cwd $RepoDir -Args @("remote", "set-url", $Name, $Url)
  } else {
    Invoke-Git -Cwd $RepoDir -Args @("remote", "add", $Name, $Url)
  }
}

function Get-ParentCount {
  param(
    [Parameter(Mandatory = $true)][string]$RepoDir,
    [Parameter(Mandatory = $true)][string]$Commit
  )

  $line = Invoke-Git -Cwd $RepoDir -Args @("rev-list", "--parents", "-n", "1", $Commit)
  if ([string]::IsNullOrWhiteSpace($line)) {
    return 0
  }
  return ($line -split " ").Length - 1
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..") | Select-Object -ExpandProperty Path

Invoke-Git -Cwd $repoRoot -Args @("rev-parse", "--is-inside-work-tree") | Out-Null
Invoke-Git -Cwd $repoRoot -Args @("cat-file", "-t", $AnchorCommit) | Out-Null
Invoke-Git -Cwd $repoRoot -Args @("merge-base", "--is-ancestor", $AnchorCommit, $SourceBranch) | Out-Null

$anchorParent = Invoke-Git -Cwd $repoRoot -Args @("rev-parse", "$AnchorCommit^")
$sourceHead = Invoke-Git -Cwd $repoRoot -Args @("rev-parse", $SourceBranch)

$publishDirFull = $PublishDir
if (-not [System.IO.Path]::IsPathRooted($PublishDir)) {
  $publishDirFull = Join-Path $repoRoot $PublishDir
}
$publishDirFull = [System.IO.Path]::GetFullPath($publishDirFull)

$publishGitDir = Join-Path $publishDirFull ".git"
$publishExists = Test-Path $publishGitDir

if (-not $publishExists) {
  if (Test-Path $publishDirFull) {
    $existingFiles = Get-ChildItem -LiteralPath $publishDirFull -Force -ErrorAction SilentlyContinue
    if ($existingFiles -and $existingFiles.Count -gt 0) {
      throw "Publish directory is not empty: $publishDirFull"
    }
  } else {
    New-Item -ItemType Directory -Path $publishDirFull | Out-Null
  }

  Invoke-Git -Cwd $publishDirFull -Args @("init")
  Invoke-Git -Cwd $publishDirFull -Args @("branch", "-M", "main")

  $archivePath = Join-Path $env:TEMP "publish-initial.zip"
  if (Test-Path $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
  }
  Invoke-Git -Cwd $repoRoot -Args @("archive", "--format=zip", "-o", $archivePath, $anchorParent)
  Expand-Archive -Path $archivePath -DestinationPath $publishDirFull -Force
  Remove-Item -LiteralPath $archivePath -Force

  Invoke-Git -Cwd $publishDirFull -Args @("add", "-A")
  Invoke-Git -Cwd $publishDirFull -Args @("commit", "-m", "initial")

  Invoke-Git -Cwd $publishDirFull -Args @("config", "--local", "publish.anchorCommit", $AnchorCommit)
  Invoke-Git -Cwd $publishDirFull -Args @("config", "--local", "publish.sourceRepo", $repoRoot)
  Invoke-Git -Cwd $publishDirFull -Args @("config", "--local", "publish.sourceBranch", $SourceBranch)
} else {
  $storedAnchor = Invoke-Git -Cwd $publishDirFull -Args @("config", "--local", "--get", "publish.anchorCommit") -AllowFail
  if ([string]::IsNullOrWhiteSpace($storedAnchor)) {
    throw "Publish repo exists but missing publish.anchorCommit in git config: $publishDirFull"
  }
  if ($storedAnchor.Trim() -ne $AnchorCommit) {
    throw "Anchor mismatch. Repo has $storedAnchor but script requested $AnchorCommit"
  }
}

$dirty = Invoke-Git -Cwd $publishDirFull -Args @("status", "--porcelain") -AllowFail
if (-not [string]::IsNullOrWhiteSpace($dirty)) {
  throw "Publish repo has uncommitted changes. Clean it before running this script."
}

$cherryPickHead = Join-Path $publishGitDir "CHERRY_PICK_HEAD"
if (Test-Path $cherryPickHead) {
  throw "Publish repo has an in-progress cherry-pick. Resolve or abort it before running this script."
}

Ensure-Remote -RepoDir $publishDirFull -Name "source" -Url $repoRoot
Invoke-Git -Cwd $publishDirFull -Args @("fetch", "source", $SourceBranch)

if (-not [string]::IsNullOrWhiteSpace($RemoteUrl)) {
  Ensure-Remote -RepoDir $publishDirFull -Name $RemoteName -Url $RemoteUrl
}

$lastSynced = Invoke-Git -Cwd $publishDirFull -Args @("config", "--local", "--get", "publish.lastSyncedCommit") -AllowFail
if ([string]::IsNullOrWhiteSpace($lastSynced)) {
  $lastSynced = $anchorParent
}

Invoke-Git -Cwd $repoRoot -Args @("merge-base", "--is-ancestor", $lastSynced, $SourceBranch) | Out-Null

$commitList = Invoke-Git -Cwd $repoRoot -Args @("rev-list", "--reverse", "$lastSynced..$SourceBranch") -AllowFail
if ([string]::IsNullOrWhiteSpace($commitList)) {
  Write-Host "No new commits to apply."
} else {
  $commits = $commitList -split "`r?`n"
  foreach ($commit in $commits) {
    if ([string]::IsNullOrWhiteSpace($commit)) {
      continue
    }
    $parentCount = Get-ParentCount -RepoDir $repoRoot -Commit $commit
    if ($parentCount -gt 1) {
      Invoke-Git -Cwd $publishDirFull -Args @("cherry-pick", "-m", "1", $commit)
    } else {
      Invoke-Git -Cwd $publishDirFull -Args @("cherry-pick", $commit)
    }
    Invoke-Git -Cwd $publishDirFull -Args @("config", "--local", "publish.lastSyncedCommit", $commit)
  }
}

Invoke-Git -Cwd $publishDirFull -Args @("config", "--local", "publish.lastSyncedCommit", $sourceHead)

if ($Push) {
  Invoke-Git -Cwd $publishDirFull -Args @("push", $RemoteName, "HEAD:$RemoteBranch")
}

Write-Host "Publish repo updated at $publishDirFull"
