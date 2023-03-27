#!/bin/bash

jq_cmd=jq
[[ $(type -P "$jq_cmd") ]] || { 
	echo "'$jq_cmd' command line JSON processor not found";
	echo "Please install on linux with 'sudo apt-get install jq'"
	echo "Please install on mac with 'brew install jq'"
	exit 1; 
}