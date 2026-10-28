param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $Root "apps\desktop\src-tauri\icons\128x128.png"
$outputDir = Join-Path $Root "apps\desktop\src-tauri\windows"
$headerPath = Join-Path $outputDir "installer-header.bmp"
$sidebarPath = Join-Path $outputDir "installer-sidebar.bmp"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$source = [System.Drawing.Image]::FromFile($sourcePath)

function New-VoidBitmap([int]$width, [int]$height, [string]$path, [int]$logoSize, [int]$logoX, [int]$logoY, [bool]$line) {
  $bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Black)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($source, $logoX, $logoY, $logoSize, $logoSize)

  if ($line) {
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(72, 232, 237, 244), 1)
    $graphics.DrawLine($pen, 18, $height - 24, $width - 18, $height - 24)
    $pen.Dispose()
  }

  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $graphics.Dispose()
  $bitmap.Dispose()
}

try {
  New-VoidBitmap 150 57 $headerPath 38 101 9 $false
  New-VoidBitmap 164 314 $sidebarPath 76 44 48 $true
} finally {
  $source.Dispose()
}

Write-Host "Generated $headerPath"
Write-Host "Generated $sidebarPath"
