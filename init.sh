#!/bin/sh

echo == init begin ==

echo Configuring git to use pre-commit hook
git config core.hooksPath hooks/

echo == init end ==
