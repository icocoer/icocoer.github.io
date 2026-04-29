#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${FORCE_NATIVE_SHELL:-}" ]] && command -v pwsh >/dev/null 2>&1; then
    pwsh "$REPO_ROOT/generate-sitemap.ps1" "$@"
    exit $?
fi

if [[ -z "${FORCE_NATIVE_SHELL:-}" ]] && [[ -z "${WSL_DISTRO_NAME:-}" ]] && command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$REPO_ROOT/generate-sitemap.ps1" "$@"
    exit $?
fi

SITE_URL="${SITE_URL:-}"
OUTPUT_PATH="${OUTPUT_PATH:-$REPO_ROOT/sitemap.xml}"

if [[ $# -ge 1 && -n "${1:-}" ]]; then
    SITE_URL="$1"
fi

if [[ $# -ge 2 && -n "${2:-}" ]]; then
    OUTPUT_PATH="$2"
fi

if [[ -z "$SITE_URL" && -f "$REPO_ROOT/CNAME" ]]; then
    SITE_URL="https://$(head -n 1 "$REPO_ROOT/CNAME" | tr -d '\r')"
fi

if [[ -z "$SITE_URL" ]]; then
    echo "Site URL is required. Pass it as the first argument or set SITE_URL." >&2
    exit 1
fi

SITE_URL="${SITE_URL%/}"

xml_escape() {
    local value="$1"
    value="${value//&/&amp;}"
    value="${value//</&lt;}"
    value="${value//>/&gt;}"
    value="${value//\"/&quot;}"
    value="${value//\'/&apos;}"
    printf '%s' "$value"
}

to_web_path() {
    local relative_path="$1"

    if [[ "$relative_path" == "index.html" ]]; then
        printf '/'
        return
    fi

    if [[ "$relative_path" == */index.html ]]; then
        printf '/%s/' "${relative_path%/index.html}"
        return
    fi

    printf '/%s' "$relative_path"
}

iso_utc() {
    local file_path="$1"
    if date -u -r "$file_path" '+%Y-%m-%dT%H:%M:%SZ' >/dev/null 2>&1; then
        date -u -r "$file_path" '+%Y-%m-%dT%H:%M:%SZ'
    else
        date -u -d "@$(stat -c '%Y' "$file_path")" '+%Y-%m-%dT%H:%M:%SZ'
    fi
}

entries=()

while IFS= read -r -d '' file_path; do
    relative_path="${file_path#$REPO_ROOT/}"
    web_path="$(to_web_path "$relative_path")"
    entries+=("${SITE_URL}${web_path}|$(iso_utc "$file_path")")
done < <(find "$REPO_ROOT" -type f -name '*.html' ! -name '404.html' -print0 | sort -z)

DOCS_ROOT="$REPO_ROOT/views/document/docs"
DOCS_BASE="$REPO_ROOT/views/document/"
if [[ -d "$DOCS_ROOT" ]]; then
    while IFS= read -r -d '' file_path; do
        relative_doc_path="${file_path#$DOCS_BASE}"
        entries+=("${SITE_URL}/views/document/document.html?doc=${relative_doc_path}|$(iso_utc "$file_path")")
    done < <(find "$DOCS_ROOT" -type f -name '*.md' -print0 | sort -z)
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"

{
    printf '%s\n' '<?xml version="1.0" encoding="UTF-8"?>'
    printf '%s\n' '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    printf '%s\n' "$(printf '%s\n' "${entries[@]}" | sort -u | while IFS='|' read -r loc lastmod; do
        printf '  <url>\n'
        printf '    <loc>%s</loc>\n' "$(xml_escape "$loc")"
        printf '    <lastmod>%s</lastmod>\n' "$lastmod"
        printf '  </url>\n'
    done)"
    printf '%s\n' '</urlset>'
} > "$OUTPUT_PATH"

echo "Generated sitemap: $OUTPUT_PATH"