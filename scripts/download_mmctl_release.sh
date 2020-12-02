#!/usr/bin/env bash
# $1 - version to download

if [[ "$OS" = "Windows_NT" ]]
then
  PLATFORM="Windows"
else
  PLATFORM=$(uname)
fi

if [[ ! -z "$1" ]];
then
  OVERRIDE_OS=$1
fi

BIN_PATH=${2:-bin}

# strip whitespace
THIS_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$THIS_BRANCH" =~ 'release-'[0-9] ]];
then
  RELEASE_TO_DOWNLOAD="$THIS_BRANCH"
else
  RELEASE_TO_DOWNLOAD=master
fi

echo "Downloading prepackaged binary: https://releases.mattermost.com/mmctl/$RELEASE_TO_DOWNLOAD";

# When packaging we need to download different platforms
# Values need to match the case statement below
if [[ ! -z "$OVERRIDE_OS" ]];
then
  PLATFORM="$OVERRIDE_OS"
fi

case "$PLATFORM" in

Linux)
  MMCTL_FILE="linux_amd64.tar" && curl -f -O -L https://releases.mattermost.com/mmctl/"$RELEASE_TO_DOWNLOAD"/"$MMCTL_FILE" && tar -xvf "$MMCTL_FILE" -C "$BIN_PATH" && rm "$MMCTL_FILE";
  ;;

Darwin)
  MMCTL_FILE="darwin_amd64.tar" && curl -f -O -L https://releases.mattermost.com/mmctl/"$RELEASE_TO_DOWNLOAD"/"$MMCTL_FILE" && tar -xvf "$MMCTL_FILE" -C "$BIN_PATH" && rm "$MMCTL_FILE";
  ;;

Windows)
  MMCTL_FILE="windows_amd64.zip" && curl -f -O -L https://releases.mattermost.com/mmctl/"$RELEASE_TO_DOWNLOAD"/"$MMCTL_FILE" && unzip -o "$MMCTL_FILE" -d "$BIN_PATH" && rm "$MMCTL_FILE";
  ;;

*)
  echo "error downloading mmctl: can't detect OS";
  ;;

esac
