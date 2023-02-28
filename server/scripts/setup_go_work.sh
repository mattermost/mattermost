#!/bin/bash

if [[ $1 != "true" ]] ;
then
    echo "Creating a go.work file"

    txt="go 1.19\n\nuse ./\n"
    
    if [ "$BUILD_ENTERPRISE_READY" == "true" ] 
    then
        txt="${txt}use ../../enterprise\n"
    fi
    
    if [ "$BUILD_PLAYBOOKS" == "true" ]
    then
        txt="${txt}use ../../mattermost-plugin-playbooks\n"
    fi

    if [ "$USE_LOCAL_PLUGIN_API" == "true" ]
    then
        txt="${txt}use ../../mattermost-plugin-api\n"
    fi

    printf "$txt" > "go.work"
fi
