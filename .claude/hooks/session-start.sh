#!/bin/bash
set -euo pipefail

# Claude Code on the web can restore this container from an earlier filesystem
# snapshot, leaving a stale git checkout (older commit) and a missing
# node_modules. This hook self-heals both. It is a no-op outside the remote env.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"

if [ -n "$branch" ] && [ "$branch" != "HEAD" ]; then
  if git fetch --quiet origin "$branch" 2>/dev/null; then
    if [ -n "$(git status --porcelain)" ]; then
      # Never destroy uncommitted work; just leave the fetched refs available.
      echo "session-start: working tree has uncommitted changes; skipping git sync" >&2
    elif git merge-base --is-ancestor HEAD "origin/$branch" 2>/dev/null \
         && [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$branch")" ]; then
      # Clean tree and strictly behind the remote → safe to fast-forward.
      # (An ancestor check means we never discard local-only commits.)
      echo "session-start: fast-forwarding $branch to origin/$branch"
      git reset --hard "origin/$branch"
    fi
  fi
fi

# Restore workspace dependencies (a restored snapshot can lose node_modules).
npm install --no-audit --no-fund
