#!/bin/bash

jq_cmd=jq
[[ $(type -P "$jq_cmd") ]] || { 
	echo "'$jq_cmd' command line JSON processor not found";
	echo "Please install on linux with 'sudo apt-get install jq'"
	echo "Please install on mac with 'brew install jq'"
	exit 1; 
}

ldapsearch_cmd=ldapsearch
[[ $(type -P "$ldapsearch_cmd") ]] || { 
	echo "'$ldapsearch_cmd' shell accessible interface to ldap not found";
	echo "Please install on linux with 'sudo apt-get install ldap-utils'"
	exit 1; 
}

if [[ -z ${1} ]]; then
	echo "We could not find a username";
	echo "usage: ./ldap-check.sh [username]"
	echo "example: ./ldap-check.sh john"
	exit 1;
fi

echo "Looking for config.json"

config_file=
if [[ -e "./config.json" ]]; then
	config_file="./config.json"
	echo "Found config at $config_file";
fi

if [[ -z ${config_file} && -e "./config/config.json" ]]; then
	config_file="./config/config.json"
	echo "Found config at $config_file";
fi

if [[ -z ${config_file} && -e "../config/config.json" ]]; then
	config_file="../config/config.json"
	echo "Found config at $config_file";
fi

if [[ -z ${config_file} ]]; then
	echo "We could not find config.json";
	exit 1;
fi

LdapServer=`cat $config_file | jq -r .LdapSettings.LdapServer`
LdapPort=`cat $config_file | jq -r .LdapSettings.LdapPort`
BindUsername=`cat $config_file | jq -r .LdapSettings.BindUsername`
BindPassword=`cat $config_file | jq -r .LdapSettings.BindPassword`
BaseDN=`cat $config_file | jq -r .LdapSettings.BaseDN`
UserFilter=`cat $config_file | jq -r .LdapSettings.UserFilter`
EmailAttribute=`cat $config_file | jq -r .LdapSettings.EmailAttribute`
UsernameAttribute=`cat $config_file | jq -r .LdapSettings.UsernameAttribute`
IdAttribute=`cat $config_file | jq -r .LdapSettings.IdAttribute`

if [[ -z ${UserFilter} ]]; then
	UserFilter="($IdAttribute=$1)"
else
	UserFilter="(&($IdAttribute=$1)$UserFilter)"
fi

cmd_to_run="$ldapsearch_cmd -LLL -x -h $LdapServer -p $LdapPort -D \"$BindUsername\" -w \"$BindPassword\" -b \"$BaseDN\" \"$UserFilter\" $IdAttribute $UsernameAttribute $EmailAttribute"
echo $cmd_to_run
echo "-------------------------"
eval $cmd_to_run
