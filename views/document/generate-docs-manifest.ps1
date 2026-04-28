param(
    [string]$DocsRoot = (Join-Path $PSScriptRoot 'docs'),
    [string]$OutputPath = (Join-Path $PSScriptRoot 'docs-manifest.json')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Convert-NameToTitle {
    param([string]$Name)

    $parts = @($Name -split '[-_]')
    $parts = @($parts | Where-Object { $_ -ne '' } | ForEach-Object {
        if ($_.Length -gt 1) {
            $_.Substring(0, 1).ToUpper() + $_.Substring(1)
        } else {
            $_.ToUpper()
        }
    })

    if ($parts.Length -eq 0) {
        return $Name
    }

    return ($parts -join ' ')
}

function Get-MarkdownTitle {
    param([string]$FilePath)

    foreach ($line in Get-Content -LiteralPath $FilePath -Encoding UTF8) {
        if ($line -match '^#\s+(.+)$') {
            return $Matches[1].Trim()
        }
    }

    return Convert-NameToTitle ([System.IO.Path]::GetFileNameWithoutExtension($FilePath))
}

function Build-Tree {
    param(
        [string]$DirectoryPath,
        [string]$RelativeBase = 'docs'
    )

    $items = @()

    $files = Get-ChildItem -LiteralPath $DirectoryPath -File -Filter '*.md' |
        Sort-Object @{ Expression = { if ($_.BaseName -eq 'index') { 0 } else { 1 } } }, Name

    foreach ($file in $files) {
        $relativePath = ($RelativeBase + '/' + $file.Name).Replace('\\', '/')
        $items += [ordered]@{
            type = 'file'
            name = $file.BaseName
            title = Get-MarkdownTitle $file.FullName
            path = $relativePath
        }
    }

    $directories = Get-ChildItem -LiteralPath $DirectoryPath -Directory | Sort-Object Name
    foreach ($directory in $directories) {
        $childBase = ($RelativeBase + '/' + $directory.Name).Replace('\\', '/')
        $children = Build-Tree -DirectoryPath $directory.FullName -RelativeBase $childBase
        if ($children.Count -gt 0) {
            $items += [ordered]@{
                type = 'dir'
                name = $directory.Name
                title = Convert-NameToTitle $directory.Name
                path = $childBase
                children = $children
            }
        }
    }

    return ,$items
}

if (-not (Test-Path -LiteralPath $DocsRoot)) {
    throw "Docs root not found: $DocsRoot"
}

$manifest = [ordered]@{
    generatedAt = (Get-Date).ToString('s')
    items = Build-Tree -DirectoryPath $DocsRoot
}

$json = $manifest | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($OutputPath, $json, [System.Text.Encoding]::UTF8)
Write-Output "Generated manifest: $OutputPath"