#!/usr/bin/env bash

set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -z "${FORCE_NATIVE_SHELL:-}" ]] && command -v pwsh >/dev/null 2>&1; then
    pwsh "$SCRIPT_ROOT/generate-docs-manifest.ps1" "$@"
    exit $?
fi

if [[ -z "${FORCE_NATIVE_SHELL:-}" ]] && [[ -z "${WSL_DISTRO_NAME:-}" ]] && command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$SCRIPT_ROOT/generate-docs-manifest.ps1" "$@"
    exit $?
fi

DOCS_ROOT="${1:-$SCRIPT_ROOT/docs}"
OUTPUT_PATH="${2:-$SCRIPT_ROOT/docs-manifest.json}"

if [[ ! -d "$DOCS_ROOT" ]]; then
    echo "Docs root not found: $DOCS_ROOT" >&2
    exit 1
fi

json_escape() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    value="${value//$'\n'/\\n}"
    value="${value//$'\r'/}"
    value="${value//$'\t'/\\t}"
    printf '%s' "$value"
}

titleize() {
    local name="$1"
    awk 'BEGIN {
        gsub(/[-_]+/, " ", ARGV[1]);
        split(ARGV[1], parts, /[[:space:]]+/);
        out = "";
        for (i = 1; i <= length(parts); i++) {
            if (parts[i] == "") continue;
            first = substr(parts[i], 1, 1);
            rest = substr(parts[i], 2);
            word = toupper(first) rest;
            out = out (out ? " " : "") word;
        }
        print out ? out : ARGV[1];
    }' "$name"
}

get_markdown_title() {
    local file_path="$1"
    local heading
    heading="$(awk '/^# +/ { sub(/^# +/, ""); print; exit }' "$file_path")"

    if [[ -n "$heading" ]]; then
        printf '%s' "$heading"
        return
    fi

    local file_name
    file_name="$(basename "$file_path" .md)"
    titleize "$file_name"
}

get_generated_at() {
    local latest_file
    latest_file="$(find "$DOCS_ROOT" -type f -name '*.md' -print0 | xargs -0 ls -1t 2>/dev/null | head -n 1 || true)"

    if [[ -n "$latest_file" ]]; then
        if date -u -r "$latest_file" '+%Y-%m-%dT%H:%M:%SZ' >/dev/null 2>&1; then
            date -u -r "$latest_file" '+%Y-%m-%dT%H:%M:%SZ'
        else
            date -u -d "@$(stat -c '%Y' "$latest_file")" '+%Y-%m-%dT%H:%M:%SZ'
        fi
        return
    fi

    if date -u -r "$DOCS_ROOT" '+%Y-%m-%dT%H:%M:%SZ' >/dev/null 2>&1; then
        date -u -r "$DOCS_ROOT" '+%Y-%m-%dT%H:%M:%SZ'
    else
        date -u -d "@$(stat -c '%Y' "$DOCS_ROOT")" '+%Y-%m-%dT%H:%M:%SZ'
    fi
}

build_tree() {
    local directory_path="$1"
    local relative_base="$2"
    local first_entry=1

    printf '['

    while IFS= read -r -d '' file_path; do
        local base_name title relative_path
        base_name="$(basename "$file_path" .md)"
        title="$(get_markdown_title "$file_path")"
        relative_path="${relative_base}/$(basename "$file_path")"

        if [[ $first_entry -eq 0 ]]; then
            printf ','
        fi
        first_entry=0

        printf '\n      {"type":"file","name":"%s","title":"%s","path":"%s"}' \
            "$(json_escape "$base_name")" \
            "$(json_escape "$title")" \
            "$(json_escape "$relative_path")"
    done < <(
        find "$directory_path" -maxdepth 1 -type f -name 'index.md' -print0
        find "$directory_path" -maxdepth 1 -type f -name '*.md' ! -name 'index.md' -print0 | sort -z
    )

    while IFS= read -r -d '' child_dir; do
        local dir_name dir_title child_base child_json
        dir_name="$(basename "$child_dir")"
        dir_title="$(titleize "$dir_name")"
        child_base="${relative_base}/${dir_name}"
        child_json="$(build_tree "$child_dir" "$child_base")"

        if [[ "$child_json" == '[]' ]]; then
            continue
        fi

        if [[ $first_entry -eq 0 ]]; then
            printf ','
        fi
        first_entry=0

        printf '\n      {"type":"dir","name":"%s","title":"%s","path":"%s","children":%s}' \
            "$(json_escape "$dir_name")" \
            "$(json_escape "$dir_title")" \
            "$(json_escape "$child_base")" \
            "$child_json"
    done < <(find "$directory_path" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)

    if [[ $first_entry -eq 0 ]]; then
        printf '\n    '
    fi
    printf ']'
}

generated_at="$(get_generated_at)"
items_json="$(build_tree "$DOCS_ROOT" 'docs')"

mkdir -p "$(dirname "$OUTPUT_PATH")"

cat > "$OUTPUT_PATH" <<EOF
{
  "generatedAt": "$(json_escape "$generated_at")",
  "items": $items_json
}
EOF

echo "Generated manifest: $OUTPUT_PATH"