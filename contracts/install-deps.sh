#!/usr/bin/env bash
# Installs pinned dependencies into lib/ without git submodules.
# Each dependency is checked out at an exact commit; the script fails if the commit differs.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p lib
fetch() {
  local name="$1" url="$2" commit="$3"
  if [ -d "lib/$name/.git" ] && [ "$(git -C "lib/$name" rev-parse HEAD)" = "$commit" ]; then
    echo "lib/$name already at $commit"; return
  fi
  rm -rf "lib/$name"
  git clone --quiet --filter=blob:none "$url" "lib/$name"
  git -C "lib/$name" checkout --quiet "$commit"
  test "$(git -C "lib/$name" rev-parse HEAD)" = "$commit"
  echo "lib/$name pinned at $commit"
}
# dn404 v0.0.25 (contains the Guardian audit fixes from v0.0.17)
fetch dn404 https://github.com/Vectorized/dn404 3397cb11558ac853912ee87871422b6a29c9d346
# solady v0.1.26 (Base64, LibString)
fetch solady https://github.com/Vectorized/solady acd959aa4bd04720d640bf4e6a5c71037510cc4b
# forge-std v1.16.2
fetch forge-std https://github.com/foundry-rs/forge-std bf647bd6046f2f7da30d0c2bf435e5c76a780c1b
