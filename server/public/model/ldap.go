// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	UserAuthServiceLdap       = "ldap"
	LdapPublicCertificateName = "ldap-public.crt"
	LdapPrivateKeyName        = "ldap-private.key"
)

// For Diagnostic results
type LdapFilterTestResult struct {
	FilterName    string            `json:"filter_name"`
	FilterValue   string            `json:"filter_value"`
	TotalCount    int               `json:"total_count"`
	Message       string            `json:"message,omitempty"`
	Error         string            `json:"error"`
	SampleResults []LdapSampleEntry `json:"sample_results"`
}

type LdapSampleEntry struct {
	DN             string            `json:"dn"`
	Username       string            `json:"username,omitempty"`
	Email          string            `json:"email,omitempty"`
	FirstName      string            `json:"first_name,omitempty"`
	LastName       string            `json:"last_name,omitempty"`
	ID             string            `json:"id,omitempty"`
	DisplayName    string            `json:"display_name,omitempty"` // For groups
	AvailableAttrs map[string]string `json:"available_attributes,omitempty"`
}
