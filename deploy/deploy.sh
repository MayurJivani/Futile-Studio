#!/bin/sh
# Ship Futile-Studio to Jinx. The box keeps its own checkout at
# /opt/apps/Futile-Studio, so the unit of deployment is a fast-forward of that
# checkout, a rebuild in place and a restart of the `futile-api` systemd unit.
# The code is not copied from here, which is what makes a deploy from CI and a
# deploy from a laptop the same operation; only deploy/futile-api.service go
# over from this tree.
#
# --ff-only rather than a plain pull: if the checkout on the box has drifted,
# stop and say so rather than quietly merging something nobody wrote.
#
# Re-runnable, and the first run on an empty box sets everything up: the
# clone, the unit and /etc/apps/futile-api.env (secrets generated on the box).
# Its site block is in jinx/Caddyfile. Dev dependencies are pruned once the
# build is done. The public hostname is a Cloudflare dashboard step: Zero
# Trust > Tunnels > Public Hostname, futile.studio -> http://localhost:80.
set -eu
cd "$(dirname "$0")/.."
HOST=${HOST:-ssh.futile.studio}
NAME=futile-api
SITE=futile.studio

scp -q deploy/$NAME.service "$HOST":/tmp/
ssh "$HOST" "NAME=$NAME SITE=$SITE sh -s" <<'BOX'
set -eu
ENV=/etc/apps/$NAME.env
sudo -n touch "$ENV" && sudo -n chmod 600 "$ENV"
# Add a key only when it is missing, so a rerun never rotates a secret.
add() { sudo -n grep -q "^$1=" "$ENV" || echo "$1=$2" | sudo -n tee -a "$ENV" >/dev/null; }
add SESSION_SECRET "$(openssl rand -hex 32)"
add STREAM_SECRET "$(openssl rand -hex 32)"
add CORS_ORIGIN https://futile.studio

if ! cmp -s "/tmp/$NAME.service" "/etc/systemd/system/$NAME.service"; then
  sudo -n install -m 644 "/tmp/$NAME.service" "/etc/systemd/system/$NAME.service"
  sudo -n systemctl daemon-reload
  sudo -n systemctl enable -q "$NAME"
fi
rm -f "/tmp/$NAME.service"

[ -d /opt/apps/Futile-Studio/.git ] || git clone -q https://github.com/MayurJivani/Futile-Studio.git /opt/apps/Futile-Studio
cd /opt/apps/Futile-Studio
git pull -q --ff-only
HUSKY=0 npm ci --no-audit --no-fund --loglevel=error
npm run build
npm prune --omit=dev
# The box npm may rewrite the lockfile in its own dialect; put it back so the next pull fast-forwards.
git checkout -- package-lock.json
(cd server && HUSKY=0 npm ci --omit=dev --no-audit --no-fund --loglevel=error)
# Mount points for the unit's BindPaths (server/data, server/uploads live in /var/lib/futile-api).
mkdir -p server/data server/uploads
sudo -n systemctl restart "$NAME"

# Come back and check through Caddy, rather than trusting that a restart meant "serving".
for _ in $(seq 1 30); do
  curl -sf -o /dev/null -H "Host: $SITE" http://127.0.0.1/api/health && break
  sleep 1
done
curl -sf -o /dev/null -H "Host: $SITE" http://127.0.0.1/api/health || {
  echo "$NAME: not serving through Caddy"; sudo -n journalctl -u "$NAME" -n 30 --no-pager; exit 1
}
BOX
echo "$NAME: deployed to https://$SITE"
