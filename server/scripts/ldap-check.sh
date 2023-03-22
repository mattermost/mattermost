#!/bin/bash

./jq-dep-check.sh

ldapsearch_cmd=ldapsearch
[[ $(type -P "$ldapsearch_cmd") ]] || { 
	echo "'$ldapsearch_cmd' shell accessible interface to ldap not found";
	echo "Please install on linux with 'sudo apt-get install ldap-utils'"
	exit 1; 
}

if [[ -z ${1} ]]; then
	echo "We could not find a username";
	echo "usage: ./ldap-check.sh -u/-g [username/groupname]"
	echo "example: ./ldap-check.sh -u john"
	echo "example: ./ldap-check.sh -g admin-staff"
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
GroupFilter=`cat $config_file | jq -r .LdapSettings.GroupFilter`
GroupIdAttribute=`cat $config_file | jq -r .LdapSettings.GroupIdAttribute`

if [[ -z ${UserFilter} ]]; then
	UserFilter="($IdAttribute=$2)"
else
	UserFilter="(&($IdAttribute=$2)$UserFilter)"
fi

if [[ -z ${GroupFilter} ]]; then
	GroupFilter="($GroupIdAttribute=$2)"
else
	GroupFilter="(&($GroupIdAttribute=$2)$GroupFilter)"
fi

if [[ $1 == '-u' ]]; then

cmd_to_run="$ldapsearch_cmd -LLL -x -h $LdapServer -p $LdapPort -D \"$BindUsername\" -w \"$BindPassword\" -b \"$BaseDN\" \"$UserFilter\" $IdAttribute $UsernameAttribute $EmailAttribute"
echo $cmd_to_run
echo "-------------------------"
eval $cmd_to_run

elif [[ $1 == '-g' ]]; then

cmd_to_run="$ldapsearch_cmd -LLL -x -h $LdapServer -p $LdapPort -D \"$BindUsername\" -w \"$BindPassword\" -b \"$BaseDN\" \"$GroupFilter\""
echo $cmd_to_run
echo "-------------------------"
eval $cmd_to_run

else 
	echo "User or Group not specified"
fi
