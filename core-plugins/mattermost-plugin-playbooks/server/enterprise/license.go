// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package enterprise

import (
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

type LicenseChecker struct {
	pluginAPIClient *pluginapi.Client
}

func NewLicenseChecker(pluginAPIClient *pluginapi.Client) *LicenseChecker {
	return &LicenseChecker{
		pluginAPIClient,
	}
}

// isAtLeastE20Licensed returns true when the server either has an E20 license or is configured for development.
func (e *LicenseChecker) isAtLeastE20Licensed() bool {
	config := e.pluginAPIClient.Configuration.GetConfig()
	license := e.pluginAPIClient.System.GetLicense()

	return pluginapi.IsE20LicensedOrDevelopment(config, license)
}

// isAtLeastE10Licensed returns true when the server either has at least an E10 license or is configured for development.
func (e *LicenseChecker) isAtLeastE10Licensed() bool {
	config := e.pluginAPIClient.Configuration.GetConfig()
	license := e.pluginAPIClient.System.GetLicense()

	return pluginapi.IsE10LicensedOrDevelopment(config, license)
}

// PlaybookAllowed returns true if the specified playbook is valid with the current license.
func (e *LicenseChecker) PlaybookAllowed(isPlaybookPublic bool) bool {
	// Private playbooks are E20-only
	return e.isAtLeastE20Licensed() || isPlaybookPublic
}

// RetrospectiveAllowed returns true if the retrospective feature is allowed with the current license.
func (e *LicenseChecker) RetrospectiveAllowed() bool {
	return e.isAtLeastE10Licensed()
}

// TimelineAllowed returns true if the timeline feature is allowed with the current license.
func (e *LicenseChecker) TimelineAllowed() bool {
	return e.isAtLeastE10Licensed()
}

// StatsAllowed returns true if the stats feature is allowed with the current license.
func (e *LicenseChecker) StatsAllowed() bool {
	return e.isAtLeastE20Licensed()
}

// ChecklistItemDueDateAllowed returns true if setting/editing checklist item due date is allowed.
func (e *LicenseChecker) ChecklistItemDueDateAllowed() bool {
	return e.isAtLeastE10Licensed()
}

// PlaybookAttributesAllowed returns true if the playbook attributes feature is allowed with the current license.
func (e *LicenseChecker) PlaybookAttributesAllowed() bool {
	return e.isAtLeastE20Licensed()
}

// ConditionalPlaybooksAllowed returns true if the conditional playbooks feature is allowed with the current license.
func (e *LicenseChecker) ConditionalPlaybooksAllowed() bool {
	return e.isAtLeastE20Licensed()
}
