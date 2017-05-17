#!/bin/sh --

set -e
exec 2>&1
cat <<'EOF' | exec ../sockaddr eval -
{{GetAllInterfaces | include "name" "lo0" | printf "%v"}}
EOF
