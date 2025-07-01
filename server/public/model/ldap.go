// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	UserAuthServiceLdap       = "ldap"
	LdapPublicCertificateName = "ldap-public.crt"
	LdapPrivateKeyName        = "ldap-private.key"
)

// LdapDiagnosticTestType represents the type of LDAP diagnostic test to run
type LdapDiagnosticTestType string

const (
	LdapDiagnosticTestTypeFilters         LdapDiagnosticTestType = "filters"
	LdapDiagnosticTestTypeAttributes      LdapDiagnosticTestType = "attributes"
	LdapDiagnosticTestTypeGroupAttributes LdapDiagnosticTestType = "group_attributes"
)

// IsValid checks if the LdapDiagnosticTestType is valid
func (t LdapDiagnosticTestType) IsValid() bool {
	switch t {
	case LdapDiagnosticTestTypeFilters, LdapDiagnosticTestTypeAttributes, LdapDiagnosticTestTypeGroupAttributes:
		return true
	default:
		return false
	}
}

// For Diagnostic results
type LdapDiagnosticResult struct {
	TestName         string            `json:"test_name"`
	TestValue        string            `json:"test_value"`
	TotalCount       int               `json:"total_count"`
	EntriesWithValue int               `json:"entries_with_value"` // For Attributes
	Message          string            `json:"message,omitempty"`
	Error            string            `json:"error"`
	SampleResults    []LdapSampleEntry `json:"sample_results"`
}

type LdapSampleEntry struct {
	DN                  string            `json:"dn"`
	Username            string            `json:"username,omitempty"`
	Email               string            `json:"email,omitempty"`
	FirstName           string            `json:"first_name,omitempty"`
	LastName            string            `json:"last_name,omitempty"`
	ID                  string            `json:"id,omitempty"`
	DisplayName         string            `json:"display_name,omitempty"` // For groups
	AvailableAttributes map[string]string `json:"available_attributes,omitempty"`
}
