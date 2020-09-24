#!/usr/bin/env bash
# $1 - version to download

if [[ "$OS" = "Windows_NT" ]]
then
  PLATFORM="Windows"
else
  PLATFORM=$(uname)
fi

# strip whitespace
RELEASE_TO_DOWNLOAD=$(echo "$1" | xargs echo)
echo "Downloading prepackaged binary: https://github.com/mattermost/mmctl/releases/$RELEASE_TO_DOWNLOAD";

case "$PLATFORM" in

Linux)
  MMCTL_FILE="linux_amd64.tar" && curl -f -O -L https://github.com/mattermost/mmctl/releases/download/"$RELEASE_TO_DOWNLOAD"/"$MMCTL_FILE" && tar -xvf "$MMCTL_FILE" -C bin && rm "$MMCTL_FILE";
  ;;

Darwin)
  MMCTL_FILE="darwin_amd64.tar" && curl -f -O -L https://github.com/mattermost/mmctl/releases/download/"$RELEASE_TO_DOWNLOAD"/"$MMCTL_FILE" && tar -xvf "$MMCTL_FILE" -C bin && rm "$MMCTL_FILE";
  ;;

Windows)
  MMCTL_FILE="windows_amd64.zip" && curl -f -O -L https://github.com/mattermost/mmctl/releases/download/"$RELEASE_TO_DOWNLOAD"/"$MMCTL_FILE" && unzip -o "$MMCTL_FILE" -d bin && rm "$MMCTL_FILE";
  ;;

*)
  echo "error downloading mmctl: can't detect OS";
  ;;

esac
