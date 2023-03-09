#!/usr/bin/env bash

make build-templates

if [[ `git status templates/ --porcelain` ]]; then
  echo "mjml templates have changed; Please compile and include compiled files"
  git diff templates/  # show diffs as part of error message
  exit 1
else
  echo "PASS"
fi
