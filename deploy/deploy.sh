#!/bin/sh
# Ship futile.studio to Jinx. The box keeps its own checkout at /opt/apps/Futile-Studio, so the
# unit of deployment is a fast-forward of that checkout, a rebuild in place and
# a restart of the `futile-api` systemd unit. Nothing is copied from here, which is
# what makes a deploy from CI and a deploy from a laptop the same operation.
#
# --ff-only rather than a plain pull: if the checkout on the box has drifted,
# stop and say so rather than quietly merging something nobody wrote.
#
# The disk on Jinx is failing, so writes are kept down: the npm cache is on
# tmpfs (/tmp/npm, set in ~/.npmrc there) and dev dependencies are pruned once
# the build is done. Runtime config is /etc/apps/futile-api.env, read by the unit.
set -eu
ssh ssh.futile.studio '
  set -eu
  cd /opt/apps/Futile-Studio
  git pull --ff-only
  HUSKY=0 npm ci --no-audit --no-fund
  npm run build
  npm prune --omit=dev
  # The box npm is older than the one that wrote the lockfile, and prune
  # rewrites it to its own dialect. Put it back so the next pull fast-forwards.
  git checkout -- package-lock.json
  # The API has its own package and runs from source, so it only needs runtime deps.
  (cd server && HUSKY=0 npm ci --omit=dev --no-audit --no-fund)
  sudo -n systemctl restart futile-api

  # Come back and check, rather than trusting that a restart meant "serving".
  sleep 5
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/ || true)
  case "$code" in
    2*|3*|404) echo "futile: serving on 127.0.0.1:4000 (HTTP $code)" ;;
    *) echo "futile: not serving (HTTP $code)"; sudo -n journalctl -u futile-api -n 30 --no-pager; exit 1 ;;
  esac
'
echo "futile: deployed to https://futile.studio"
