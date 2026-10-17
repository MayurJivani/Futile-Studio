#!/bin/sh
# Ship a preview build to https://staging.futile.studio/futile-studio/ so a
# version can be looked at before it goes live. Production is untouched: a
# different web root, a different site block, and the live API is not wired in
# (the shared studio and the Jinx readout say the box is quiet, as they do
# whenever the backend is unreachable).
#
# Same shape as deploy.sh: no privileges, re-runnable, and the shared staging
# block is only reinstalled (validated, then reloaded) when it changed.
set -eu
cd "$(dirname "$0")/.."
NAME=futile-studio

SITE_BASE="/$NAME/" npm run build

scp -q deploy/staging.caddy ssh.futile.studio:/tmp/staging.caddy.incoming
ssh ssh.futile.studio '
  set -eu
  mkdir -p /opt/apps/staging/'"$NAME"'
  LIVE=/etc/caddy/conf.d/staging.caddy
  IN=/tmp/staging.caddy.incoming

  if cmp -s "$IN" "$LIVE"; then
    rm -f "$IN"
  else
    # Imported into the config every site is served from: validate with the
    # block in place and put the old one back if Caddy rejects the result.
    cp "$LIVE" "$IN.prev" 2>/dev/null || true
    mv "$IN" "$LIVE"
    if ! caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
      if [ -f "$IN.prev" ]; then mv "$IN.prev" "$LIVE"; else rm -f "$LIVE"; fi
      echo "staging: site block rejected by caddy validate, config unchanged" >&2
      exit 1
    fi
    rm -f "$IN.prev"
    sudo -n systemctl reload caddy
    echo "staging: site block installed and caddy reloaded"
  fi
'

tar czf - -C dist . | ssh ssh.futile.studio '
  set -eu
  cd /opt/apps/staging/'"$NAME"'
  find . -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  tar xzf -
'
echo "staging: https://staging.futile.studio/$NAME/"
