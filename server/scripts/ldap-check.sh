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
	echo "usage: ./ldap-check.sh -u/-g [username/groupname]"
	echo "example: ./ldap-check.sh -u john"
	echo "example: ./ldap-check.sh -g admin-staff"
	exit 1;
fi

find_config_file() {
	local config_paths=("./config.json" "./config/config.json" "../config/config.json" "/opt/mattermost/config/config.json")
	
	for path in "${config_paths[@]}"; do
		if [[ -e "$path" ]]; then
			echo "$path"
			return 0
		fi
	done
	
	return 1
}

config_file=$(find_config_file)
if [[ $? -ne 0 ]]; then
	echo "We could not find config.json"
	exit 1
fi

LdapServer=`cat $config_file | jq -r .LdapSettings.LdapServer`
LdapPort=`cat $config_file | jq -r .LdapSettings.LdapPort`
ConnectionSecurity=`cat $config_file | jq -r .LdapSettings.ConnectionSecurity`
BindUsername=`cat $config_file | jq -r .LdapSettings.BindUsername`
BindPassword=`cat $config_file | jq -r .LdapSettings.BindPassword`
BaseDN=`cat $config_file | jq -r .LdapSettings.BaseDN`
UserFilter=`cat $config_file | jq -r .LdapSettings.UserFilter`
EmailAttribute=`cat $config_file | jq -r .LdapSettings.EmailAttribute`
UsernameAttribute=`cat $config_file | jq -r .LdapSettings.UsernameAttribute`
IdAttribute=`cat $config_file | jq -r .LdapSettings.IdAttribute`
GroupFilter=`cat $config_file | jq -r .LdapSettings.GroupFilter`
GroupIdAttribute=`cat $config_file | jq -r .LdapSettings.GroupIdAttribute`

if [[ -z ${ConnectionSecurity} || ${ConnectionSecurity} == "null" ]]; then
	LdapUri="ldap://$LdapServer:$LdapPort"
	StartTlsFlag=""
elif [[ ${ConnectionSecurity} == "STARTTLS" ]]; then
	LdapUri="ldap://$LdapServer:$LdapPort"
	StartTlsFlag="-ZZ"
else
	LdapUri="ldaps://$LdapServer:$LdapPort"
	StartTlsFlag=""
fi

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

run_ldap_search() {
	local filter="$1"
	local attributes="$2"
	
	cmd_to_run="$ldapsearch_cmd -LLL -x $StartTlsFlag -H \"$LdapUri\" -D \"$BindUsername\" -w \"$BindPassword\" -b \"$BaseDN\" \"$filter\" $attributes"
	echo $cmd_to_run
	echo "-------------------------"
	eval $cmd_to_run
}

if [[ $1 == '-u' ]]; then
	run_ldap_search "$UserFilter" "$IdAttribute $UsernameAttribute $EmailAttribute"
elif [[ $1 == '-g' ]]; then
	run_ldap_search "$GroupFilter" ""
else 
	echo "User or Group not specified"
fi
