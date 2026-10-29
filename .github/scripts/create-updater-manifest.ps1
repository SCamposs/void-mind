param(
  [Parameter(Mandatory = $true)][string]$Tag,
  [Parameter(Mandatory = $true)][string]$Version,
  [Parameter(Mandatory = $true)][string]$Repository,
  [Parameter(Mandatory = $true)][string]$AssetDirectory
)
$ErrorActionPreference = "Stop"
if ($Version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$') {
  throw "The native updater version must be valid SemVer."
}
$assets = (Resolve-Path -LiteralPath $AssetDirectory).Path
$windowsSignature = (Get-Content -Raw -LiteralPath (Join-Path $assets "VOID-Mind-Windows-x64-setup.exe.sig")).Trim()
$linuxSignature = (Get-Content -Raw -LiteralPath (Join-Path $assets "VOID-Mind-Linux-x64.AppImage.sig")).Trim()
$debSignature = (Get-Content -Raw -LiteralPath (Join-Path $assets "VOID-Mind-Linux-x64.deb.sig")).Trim()
if (-not $windowsSignature -or -not $linuxSignature -or -not $debSignature) { throw "Updater signatures cannot be empty." }
$baseUrl = "https://github.com/$Repository/releases/download/$Tag"
$manifest = [ordered]@{
  version = $Version
  notes = "See the GitHub release notes for $Tag."
  pub_date = (Get-Date).ToUniversalTime().ToString("o")
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{ signature = $windowsSignature; url = "$baseUrl/VOID-Mind-Windows-x64-setup.exe" }
    "linux-x86_64" = [ordered]@{ signature = $linuxSignature; url = "$baseUrl/VOID-Mind-Linux-x64.AppImage" }
    "linux-x86_64-appimage" = [ordered]@{ signature = $linuxSignature; url = "$baseUrl/VOID-Mind-Linux-x64.AppImage" }
    "linux-x86_64-deb" = [ordered]@{ signature = $debSignature; url = "$baseUrl/VOID-Mind-Linux-x64.deb" }
  }
}
[IO.File]::WriteAllText((Join-Path $assets "latest.json"), ($manifest | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
