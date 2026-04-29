param(
    [string]$RepoRoot = $PSScriptRoot,
    [string]$SiteUrl,
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-SiteUrl {
    param([string]$RepoRootPath, [string]$Override)

    if ($Override) {
        return $Override.TrimEnd('/')
    }

    $cnamePath = Join-Path $RepoRootPath 'CNAME'
    if (Test-Path -LiteralPath $cnamePath) {
        $domain = (Get-Content -LiteralPath $cnamePath -Encoding UTF8 | Select-Object -First 1).Trim()
        if ($domain) {
            return "https://$domain"
        }
    }

    throw 'SiteUrl is required when CNAME is missing or empty.'
}

function Get-OutputPath {
    param([string]$RepoRootPath, [string]$Override)

    if ($Override) {
        return $Override
    }

    return (Join-Path $RepoRootPath 'sitemap.xml')
}

function Get-RelativePath {
    param([string]$BasePath, [string]$FullPath)

    $resolvedBasePath = (Resolve-Path -LiteralPath $BasePath).Path -replace '[\\/]+$', ''
    $resolvedFullPath = (Resolve-Path -LiteralPath $FullPath).Path

    if ($resolvedFullPath.StartsWith($resolvedBasePath, [System.StringComparison]::OrdinalIgnoreCase)) {
        return (($resolvedFullPath.Substring($resolvedBasePath.Length) -replace '^[\\/]+', '')).Replace('\\', '/')
    }

    $baseUri = [System.Uri]($resolvedBasePath + '\\')
    $fullUri = [System.Uri]$resolvedFullPath
    return $baseUri.MakeRelativeUri($fullUri).ToString().Replace('\\', '/')
}

function Convert-ToWebPath {
    param([string]$RelativePath)

    if ($RelativePath -eq 'index.html') {
        return '/'
    }

    if ($RelativePath.EndsWith('/index.html')) {
        return '/' + $RelativePath.Substring(0, $RelativePath.Length - 'index.html'.Length)
    }

    return '/' + $RelativePath
}

function Get-MarkdownViewerUrl {
    param([string]$RelativeDocPath)

    $escapedDocPath = [System.Uri]::EscapeDataString($RelativeDocPath)
    return "/views/document/document.html?doc=$escapedDocPath"
}

function New-UrlEntry {
    param(
        [string]$Location,
        [DateTime]$LastModified
    )

    return [pscustomobject]@{
        loc = $Location
        lastmod = $LastModified.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    }
}

$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
$SiteUrl = Get-SiteUrl -RepoRootPath $RepoRoot -Override $SiteUrl
$OutputPath = Get-OutputPath -RepoRootPath $RepoRoot -Override $OutputPath

$entries = New-Object System.Collections.Generic.List[object]

$htmlFiles = Get-ChildItem -LiteralPath $RepoRoot -Recurse -File -Filter '*.html' |
    Where-Object { $_.Name -ne '404.html' }

foreach ($file in $htmlFiles) {
    $relativePath = Get-RelativePath -BasePath $RepoRoot -FullPath $file.FullName
    $webPath = Convert-ToWebPath -RelativePath $relativePath
    $entries.Add((New-UrlEntry -Location ($SiteUrl + $webPath) -LastModified $file.LastWriteTimeUtc))
}

$docsRoot = Join-Path $RepoRoot 'views/document/docs'
if (Test-Path -LiteralPath $docsRoot) {
    $markdownFiles = Get-ChildItem -LiteralPath $docsRoot -Recurse -File -Filter '*.md'
    foreach ($file in $markdownFiles) {
        $relativeDocPath = Get-RelativePath -BasePath (Join-Path $RepoRoot 'views/document') -FullPath $file.FullName
        $viewerPath = Get-MarkdownViewerUrl -RelativeDocPath $relativeDocPath
        $entries.Add((New-UrlEntry -Location ($SiteUrl + $viewerPath) -LastModified $file.LastWriteTimeUtc))
    }
}

$xmlSettings = New-Object System.Xml.XmlWriterSettings
$xmlSettings.Encoding = [System.Text.UTF8Encoding]::new($false)
$xmlSettings.Indent = $true

$outputDirectory = Split-Path -Path $OutputPath -Parent
if ($outputDirectory) {
    [System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
}

$writer = [System.Xml.XmlWriter]::Create($OutputPath, $xmlSettings)

try {
    $writer.WriteStartDocument()
    $writer.WriteStartElement('urlset', 'http://www.sitemaps.org/schemas/sitemap/0.9')

    foreach ($entry in ($entries | Sort-Object loc -Unique)) {
        $writer.WriteStartElement('url')
        $writer.WriteElementString('loc', $entry.loc)
        $writer.WriteElementString('lastmod', $entry.lastmod)
        $writer.WriteEndElement()
    }

    $writer.WriteEndElement()
    $writer.WriteEndDocument()
}
finally {
    $writer.Dispose()
}

Write-Output "Generated sitemap: $OutputPath"