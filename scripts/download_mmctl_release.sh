#!/usr/bin/env bash
# $1 - version to download

if [[ "$OS" = "Windows_NT" ]]
then
	PLATFORM="Windows"
else
	PLATFORM=$(uname)
fi

if [[ -z "$1" ]]
then
	echo "An error has occured trying to get the latest mmctl release. Aborting. Perhaps api.github.com is down, or you are being rate-limited.";
	echo "Set the GITHUB_USERNAME and GITHUB_TOKEN environment variables to the appropriate values to work around Github rate-limiting.";
	exit 1;
else
    echo "Downloading prepackaged binary: https://github.com/mattermost/mmctl/releases/$1";
fi

case "$PLATFORM" in

Linux)
    MMCTL_FILE="linux_amd64.tar" && curl -f -O -L https://github.com/mattermost/mmctl/releases/download/"$1"/"$MMCTL_FILE" && tar -xvf "$MMCTL_FILE" -C bin && rm "$MMCTL_FILE";
    ;;

Darwin)
    MMCTL_FILE="darwin_amd64.tar" && curl -f -O -L https://github.com/mattermost/mmctl/releases/download/"$1"/"$MMCTL_FILE" && tar -xvf "$MMCTL_FILE" -C bin && rm "$MMCTL_FILE";
    ;;

Windows)
    MMCTL_FILE="windows_amd64.zip" && curl -f -O -L https://github.com/mattermost/mmctl/releases/download/"$1"/"$MMCTL_FILE" && unzip -o "$MMCTL_FILE" -d bin && rm "$MMCTL_FILE";
    ;;

*)
	echo "error downloading mmctl: can't detect OS";
    ;;
esac