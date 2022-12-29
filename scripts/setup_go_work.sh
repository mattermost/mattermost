#!/bin/bash

if [[ $1 != "true" ]] ;
then
    echo "Creating a go.work file"

    txt="go 1.18\n\nuse ./\n"
    
    if [ "$BUILD_ENTERPRISE_READY" == "true" ] 
    then
        txt="${txt}use ../enterprise\n"
    fi
    
    if [ "$BUILD_BOARDS" == "true" ] 
    then
        txt="${txt}use ../focalboard/server\nuse ../focalboard/mattermost-plugin\n"
    fi
    
    if [ "$BUILD_PLAYBOOKS" == "true" ]
    then
        txt="${txt}use ../mattermost-plugin-playbooks\n"
    fi

    printf "$txt" > "go.work"
fi
