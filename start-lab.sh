#!/usr/bin/env sh
# Riz Lab: one-click start (macOS / Linux). Builds if needed, serves dist/ on
# http://localhost:4173 and opens the browser. Press Ctrl+C to stop.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org (while online), then run this again."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "First run: installing packages (needs internet once)..."
  npm install || exit 1
fi
if [ ! -f dist/index.html ]; then
  echo "Building the lab..."
  npm run build || exit 1
fi

URL="http://localhost:4173/"
echo
echo "  Riz Lab is running at $URL"
echo "  Keep this window open. Press Ctrl+C to stop."
echo
# Open the browser two seconds after the server starts (NO_BROWSER=1 skips this).
if [ -z "$NO_BROWSER" ]; then
  (
    sleep 2
    if command -v open >/dev/null 2>&1; then open "$URL"
    elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
    fi
  ) >/dev/null 2>&1 &
fi
exec npx vite preview --port 4173 --strictPort
