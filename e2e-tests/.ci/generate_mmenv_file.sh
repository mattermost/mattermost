#!/bin/bash
set -e -u -o pipefail
cd $(dirname $0)
. .e2erc

: ${MM_ENV}

envarr=$(echo ${MM_ENV} | tr "," "\n")
for env in $envarr; do
  echo "> [$env]"
  echo "$env" >> "./.env.server"
done
