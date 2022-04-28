#!/bin/bash

check_prereq()
{
    local dependency=$1
    type "$dependency" >/dev/null 2>&1 || { echo >&2 "Mattermost Enterprise requires '$dependency' but it doesn't appear to be installed.  Aborting."; exit 1; }
}

echo "Checking enterprise prerequisites"

check_prereq 'xmlsec1'

if [[ ! -f "go.work" ]] ;
then
    echo "Creating a go.work file"
    cat >go.work <<EOL
go 1.18

use ./

use ../enterprise
EOL
fi