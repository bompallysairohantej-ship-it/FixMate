$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputPath = Join-Path $projectRoot 'FixMate-source.zip'
$rootFiles = @('package.json', 'package-lock.json', '.env.example', '.gitignore', '.prettierrc.json', '.prettierignore', 'README.md', 'client/package.json', 'client/index.html', 'client/vite.config.js', 'server/package.json')
$sourceFolders = @('client/src', 'client/public', 'server/src', 'docs', 'scripts')
Add-Type -AssemblyName System.IO.Compression.FileSystem
$files = @($rootFiles | ForEach-Object { Get-Item -LiteralPath (Join-Path $projectRoot $_) })
foreach ($folder in $sourceFolders) {
    $files += Get-ChildItem -LiteralPath (Join-Path $projectRoot $folder) -File -Recurse
}
$archive = [System.IO.Compression.ZipFile]::Open($outputPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($projectRoot.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, "FixMate/$relativePath", [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally {
    $archive.Dispose()
}
Write-Output "Created $outputPath ($($files.Count) files). To regenerate, move or remove the existing archive first."
