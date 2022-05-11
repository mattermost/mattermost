#!/bin/bash

if [[ ! -f "go.work" ]] ;
then
    echo "Creating a go.work file"
    cat >go.work <<EOL
go 1.18

use ./

use ../enterprise
EOL
fi