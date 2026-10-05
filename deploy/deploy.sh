#!/bin/sh
# Ship futile.studio to Jinx. Two halves with different lifetimes: the Astro
# site is a pile of static files Caddy serves straight off disk, and the API is
# a node process the `futile-api` container runs from the mounted source tree.
#
# So this builds here, copies both halves over, and restarts only the API.
# Nothing is built on the box -- there is no node there.
#
# server/data, server/uploads and server/.env are deliberately absent from the
# tarball. They are live state and live config on the box, and shipping the local
# copies would overwrite the running API's database and secrets with a laptop's.
#
# The source tree is overlaid rather than replaced, because replacing it would
# take data/ and uploads/ with it. The ceiling: a file deleted from the repo
# stays behind on the box until someone removes it by hand. Worth revisiting
# only if server/ ever starts loading modules by globbing a directory.
set -eu
cd "$(dirname "$0")/.."

npm run build

tar czf - \
    --exclude=node_modules \
    --exclude=server/data \
    --exclude=server/uploads \
    --exclude='.env' \
    dist server | ssh ssh.futile.studio '
  set -eu
  cd /opt/apps/Futile-Studio

  # dist is pure build output, so it is safe to replace wholesale -- and it has
  # to be, or a renamed page would linger as a stale route.
  rm -rf ./dist
  tar xzf -

  docker restart futile-api >/dev/null

  # `npm ci` runs on container start, so give it a moment before asking.
  sleep 10
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/ || true)
  case "$code" in
    2*|3*|404) echo "futile: api up (HTTP $code)" ;;
    *) echo "futile: api not responding (HTTP $code)"; docker logs --tail 30 futile-api; exit 1 ;;
  esac
  [ -s ./dist/index.html ] || { echo "futile: dist/index.html missing"; exit 1; }
'
echo "futile: deployed to https://futile.studio"
