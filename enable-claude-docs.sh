#!/bin/bash

# This script enables the optional Claude documentation by copying
# CLAUDE.OPTIONAL.md files to CLAUDE.md.
# CLAUDE.md files are gitignored, so they act as local-only documentation.

echo "Enabling Claude documentation..."

find . -name "CLAUDE.OPTIONAL.md" -not -path "*/node_modules/*" | while read -r file; do
    target_file="${file%.OPTIONAL.md}.md"
    echo "Copying $file to $target_file"
    cp "$file" "$target_file"
done

echo "Done! CLAUDE.md files are now active (and ignored by git). *NOTE: Re-running this script will overwrite any changes you'd made to the CLAUDE.md files. If you have an improvement, please change the relevant CLAUDE.OPTIONAL.md file instead, and submit a PR."

