#!/bin/bash

set -e

python scripts/updateLicense.py $(go list -json ./... | jq -r '.Dir + "/" + (.GoFiles | .[])')
