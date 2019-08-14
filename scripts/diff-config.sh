#!/usr/bin/env bash
if [ -z $FROM ]
then
  echo "Missing FROM version. Usage: make diff-config FROM=v1.2.3 TO=v1.2.3"
  exit 1
fi

if [ -z $TO ]
then
  echo "Missing TO version. Usage: make diff-config FROM=v1.2.3 TO=v1.2.3"
  exit 1
fi

# Flattens up a json string using dot notation for nested objects.
function flatten_json () {
  echo "$1" | jq -S '[leaf_paths as $path | {"key": $path | join("."), "value": getpath($path)}] | from_entries'
}

# Returns the config file for a specific release
function fetch_config() {
  wget -q -O- https://releases.mattermost.com/$1/mattermost-$1-linux-amd64.tar.gz | tar -xzOf - mattermost/config/config.json
}

echo Fetching config files

FROM_CONFIG=$(fetch_config "$FROM")
TO_CONFIG=$(fetch_config "$TO")

echo Comparing config files
diff -u <(flatten_json "$FROM_CONFIG") <(flatten_json "$TO_CONFIG")

# We ignore exits with 1 since it just means there's a difference, which is fine for us.
diff_exit=$?
if [ $diff_exit -eq 1 ]; then
  exit 0
else
  exit $diff_exit
fi

