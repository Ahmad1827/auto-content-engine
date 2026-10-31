#!/usr/bin/env bash
# Run inside WSL by ACE.exe, first as root to install system packages, then as the user to set up and open the app.
set -euo pipefail

VERSION="${ACE_VERSION:-main}"
REPO="${ACE_REPO:-https://github.com/Ahmad1827/auto-content-engine.git}"
HOME_DIR="${ACE_HOME:-$HOME/auto-content-engine}"
NODE_VERSION="22.11.0"
PACKAGES=(git curl xz-utils ffmpeg espeak-ng python3 python3-venv python3-pip python3-tk libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libgbm1 libxkbcommon0 libasound2t64 libpango-1.0-0 fonts-noto-core)

say() { printf '\n==> %s\n' "$1"; }

system_packages() {
  if ! command -v apt-get >/dev/null; then
    echo "ACE needs an Ubuntu or Debian WSL distribution. Install one with: wsl --install -d Ubuntu"
    exit 3
  fi
  local missing=()
  for p in "${PACKAGES[@]}"; do
    # Older Ubuntu releases name these libraries without the t64 ending.
    if [[ "$p" == *t64 ]] && ! apt-cache show "$p" >/dev/null 2>&1; then p="${p%t64}"; fi
    dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p")
  done
  [ ${#missing[@]} -eq 0 ] && return 0
  say "Installing system packages: ${missing[*]}"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq "${missing[@]}"
}

get_code() {
  if [ ! -d "$HOME_DIR/.git" ]; then
    say "Downloading ACE $VERSION"
    git clone --quiet --branch "$VERSION" "$REPO" "$HOME_DIR" 2>/dev/null || git clone --quiet "$REPO" "$HOME_DIR"
    return
  fi
  # Moves to the version of this launcher, unless the folder has local changes to keep.
  if [ -z "$(git -C "$HOME_DIR" status --porcelain --untracked-files=no)" ]; then
    git -C "$HOME_DIR" fetch --quiet --tags origin && git -C "$HOME_DIR" -c advice.detachedHead=false checkout --quiet "$VERSION" || echo "Couldn't update, so opening the version already here."
  fi
}

get_node() {
  if command -v node >/dev/null && [ "$(node -p 'parseInt(process.versions.node)')" -ge 20 ]; then
    return
  fi
  local dir="$HOME/.ace/node-v$NODE_VERSION-linux-x64"
  if [ ! -x "$dir/bin/node" ]; then
    say "Installing Node.js $NODE_VERSION"
    mkdir -p "$HOME/.ace"
    curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" | tar -xJ -C "$HOME/.ace"
  fi
  export PATH="$dir/bin:$PATH"
}

get_python() {
  local env="$HOME_DIR/wsl_env"
  local stamp="$env/.ace_requirements"
  if [ ! -x "$env/bin/python" ]; then
    say "Creating the Python environment"
    python3 -m venv "$env"
  fi
  if [ ! -f "$stamp" ] || ! cmp -s "$HOME_DIR/requirements.txt" "$stamp"; then
    say "Installing the Python packages. The first time takes several minutes and about 2 GB."
    "$env/bin/pip" install --quiet --upgrade pip
    # No GPU is needed, and the CPU build of torch is far smaller than the default one.
    "$env/bin/pip" install --quiet torch --index-url https://download.pytorch.org/whl/cpu
    "$env/bin/pip" install --quiet -r "$HOME_DIR/requirements.txt" BingImageCreator pytrends
    cp "$HOME_DIR/requirements.txt" "$stamp"
  fi
}

case "${1:-user}" in
  root) system_packages ;;
  user)
    get_code
    get_node
    get_python
    say "Opening ACE"
    cd "$HOME_DIR"
    [ "${ACE_SETUP_ONLY:-}" = 1 ] && exit 0
    exec "$HOME_DIR/wsl_env/bin/python" run.py
    ;;
esac
