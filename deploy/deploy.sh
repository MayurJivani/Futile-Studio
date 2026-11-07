#!/bin/sh
# Rebuild futile.studio's static site on Jinx. The box keeps its own checkout
# at /opt/apps/Futile-Studio and Caddy serves its dist/ (jinx/Caddyfile), so
# the unit of deployment is a fast-forward of that checkout and a rebuild in
# place. The code is not copied from here, which is what makes a deploy from
# CI and a deploy from a laptop the same operation. The API is not touched: it
# runs under Coolify (deploy/compose.yaml) and ships from image.yml.
#
# --ff-only rather than a plain pull: if the checkout on the box has drifted,
# stop and say so rather than quietly merging something nobody wrote.
#
# The board is read from SQLite at build time (src/data/board.js looks in
# server/data/studio.db). The API's live database sits in its Coolify volume
# under /var/lib/private, which only root can enter, so a copy goes into the
# checkout first; without it /admin edits never reach the static board.
set -eu
cd "$(dirname "$0")/.."
HOST=${HOST:-ssh.futile.studio}
SITE=futile.studio

ssh "$HOST" "SITE=$SITE sh -s" <<'BOX'
set -eu
LIVE=/var/lib/private/futile-api/data/studio.db

[ -d /opt/apps/Futile-Studio/.git ] || git clone -q https://github.com/MayurJivani/Futile-Studio.git /opt/apps/Futile-Studio
cd /opt/apps/Futile-Studio
git pull -q --ff-only

mkdir -p server/data
# shortcut: a plain copy can catch a write half done (rollback journal, no WAL); admin edits
# are rare and the next deploy copies again. Switch to sqlite3 .backup if a build ever reads a torn file.
# The -ef guard: if server/data ever points at the live file, the redirect would truncate it.
[ server/data/studio.db -ef "$LIVE" ] || sudo -n cat "$LIVE" > server/data/studio.db

HUSKY=0 npm ci --no-audit --no-fund --loglevel=error
npm run build
npm prune --omit=dev
# The box npm may rewrite the lockfile in its own dialect; put it back so the next pull fast-forwards.
git checkout -- package-lock.json

# Come back and check through Caddy, rather than trusting that a build meant "serving".
curl -sf -o /dev/null -H "Host: $SITE" http://127.0.0.1/ || { echo "$SITE: not serving through Caddy"; exit 1; }
BOX
echo "futile.studio: deployed to https://$SITE"
