#!/usr/bin/env bash
# Builds ACE.exe on Linux or WSL. Needs mingw-w64: sudo apt install mingw-w64. Usage: build.sh <version tag> [output path]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
version="${1:?Usage: build.sh <version tag> [output path]}"
output="${2:-$here/ACE.exe}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
{
  printf '#define ACE_VERSION "%s"\n' "$version"
  printf 'static const unsigned char SETUP_PS1[] = {'
  od -An -v -tu1 "$here/setup.ps1" | tr -s ' \n' ',' | sed 's/^,//'
  printf '};\n#define SETUP_PS1_LEN sizeof(SETUP_PS1)\n'
} > "$work/script.h"
x86_64-w64-mingw32-windres -I "$here" "$here/ace.rc" -O coff -o "$work/ace.res"
x86_64-w64-mingw32-gcc -Os -s -static -I "$work" "$here/launcher.c" "$work/ace.res" -o "$output"
echo "Built $output"
