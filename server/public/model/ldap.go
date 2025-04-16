// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strconv"
)

const (
	UserAuthServiceLdap       = "ldap"
	LdapPublicCertificateName = "ldap-public.crt"
	LdapPrivateKeyName        = "ldap-private.key"
)

type LdapSyncOptions struct {
	ReAddRemovedMembers *bool `json:"re_add_removed_members"`
}

// ToMap converts a LdapSyncOptions to a map[string]string.
func (opts *LdapSyncOptions) ToMap() map[string]string {
	m := map[string]string{}
	if opts == nil {
		return m
	}

	if opts.ReAddRemovedMembers != nil {
		m["re_add_removed_members"] = strconv.FormatBool(*opts.ReAddRemovedMembers)
	}

	return m
}

// FromMap populates a LdapSyncOptions from a map[string]string
func (opts *LdapSyncOptions) FromMap(m map[string]string) {
	if m == nil {
		return
	}

	if val, ok := m["re_add_removed_members"]; ok {
		if include, err := strconv.ParseBool(val); err == nil {
			opts.ReAddRemovedMembers = &include
		}
	}
}
