#!/bin/sh
# One-time setup on the box: hand /opt/apps/Futile-Studio to whoever deploys it.
# Needs root, and is the only step that does. The Caddy site block already
# exists and is not touched here.
#
# Why this is needed at all: the directory was created by root, and dist/ came
# out root:root 755. A deploy replaces dist wholesale, and unlinking a file
# needs write on the directory holding it, so every deploy failed on
# "cannot remove './dist/index.html': Permission denied" -- a permission error
# a long way from its cause. Knock, Murmur and Sextant avoid this by having
# their install.sh create the directory owned by the deploy user; this does the
# same thing after the fact.
#
# Copy it over first, then run it on a terminal:
#
#   scp deploy/install.sh ssh.futile.studio:/tmp/futile-install.sh
#   ssh -t ssh.futile.studio 'sudo sh /tmp/futile-install.sh; rm -f /tmp/futile-install.sh'
#
# Piping it in over `sudo sh -s` does not work: sudo wants a terminal to read
# the password from, and stdin is already carrying the script. Cubby and Lab
# stage deploy/ onto the box for the same reason.
#
# Re-runnable, and harmless if ownership is already correct.
set -eu

APP=/opt/apps/Futile-Studio

if [ "$(id -u)" -ne 0 ]; then
  echo "install.sh changes ownership under $APP, so it needs root:" >&2
  echo "  ssh ssh.futile.studio 'sudo sh -s' < deploy/install.sh" >&2
  exit 1
fi

[ -d "$APP" ] || { echo "install.sh: $APP does not exist" >&2; exit 1; }

# `sudo` exports SUDO_USER and `su -` does not, so fall back to whoever owns the
# app directory's parent rather than guessing root.
OWNER="${SUDO_USER:-$(stat -c %U "$APP")}"
[ "$OWNER" != "root" ] || { echo "install.sh: refusing to chown to root" >&2; exit 1; }

# The whole tree, not just dist: server/ is overlaid by a deploy too, and
# node_modules in there is recreated root-owned by the container's own `npm ci`
# on every restart, which is fine because the deploy never touches it.
chown -R "$OWNER:docker" "$APP"
chmod 775 "$APP" "$APP/dist" "$APP/server"

echo "futile: $APP now owned by $OWNER:docker"
