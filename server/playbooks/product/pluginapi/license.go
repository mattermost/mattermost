// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
)

const (
	e10          = "E10"
	e20          = "E20"
	professional = "professional"
	enterprise   = "enterprise"
)

// IsEnterpriseLicensedOrDevelopment returns true when the server is licensed with any Mattermost
// Enterprise License, or has `EnableDeveloper` and `EnableTesting` configuration settings
// enabled signaling a non-production, developer mode.
func IsEnterpriseLicensedOrDevelopment(config *model.Config, license *model.License) bool {
	if license != nil {
		return true
	}

	return IsConfiguredForDevelopment(config)
}

// isValidSkuShortName returns whether the SKU short name is one of the known strings;
// namely: E10 or professional, or E20 or enterprise
func isValidSkuShortName(license *model.License) bool {
	if license == nil {
		return false
	}

	switch license.SkuShortName {
	case e10, e20, professional, enterprise:
		return true
	default:
		return false
	}
}

// IsE10LicensedOrDevelopment returns true when the server is at least licensed with a legacy Mattermost
// Enterprise E10 License or a Mattermost Professional License, or has `EnableDeveloper` and
// `EnableTesting` configuration settings enabled, signaling a non-production, developer mode.
func IsE10LicensedOrDevelopment(config *model.Config, license *model.License) bool {
	if license != nil &&
		(license.SkuShortName == e10 || license.SkuShortName == professional ||
			license.SkuShortName == e20 || license.SkuShortName == enterprise) {
		return true
	}

	if !isValidSkuShortName(license) {
		// As a fallback for licenses whose SKU short name is unknown, make a best effort to try
		// and use the presence of a known E10/Professional feature as a check to determine licensing.
		if license != nil &&
			license.Features != nil &&
			license.Features.LDAP != nil &&
			*license.Features.LDAP {
			return true
		}
	}

	return IsConfiguredForDevelopment(config)
}

// IsE20LicensedOrDevelopment returns true when the server is licensed with a legacy Mattermost
// Enterprise E20 License or a Mattermost Enterprise License, or has `EnableDeveloper` and
// `EnableTesting` configuration settings enabled, signaling a non-production, developer mode.
func IsE20LicensedOrDevelopment(config *model.Config, license *model.License) bool {
	if license != nil && (license.SkuShortName == e20 || license.SkuShortName == enterprise) {
		return true
	}

	if !isValidSkuShortName(license) {
		// As a fallback for licenses whose SKU short name is unknown, make a best effort to try
		// and use the presence of a known E20/Enterprise feature as a check to determine licensing.
		if license != nil &&
			license.Features != nil &&
			license.Features.FutureFeatures != nil &&
			*license.Features.FutureFeatures {
			return true
		}
	}

	return IsConfiguredForDevelopment(config)
}

// IsConfiguredForDevelopment returns true when the server has `EnableDeveloper` and `EnableTesting`
// configuration settings enabled, signaling a non-production, developer mode.
func IsConfiguredForDevelopment(config *model.Config) bool {
	if config != nil &&
		config.ServiceSettings.EnableTesting != nil &&
		*config.ServiceSettings.EnableTesting &&
		config.ServiceSettings.EnableDeveloper != nil &&
		*config.ServiceSettings.EnableDeveloper {
		return true
	}

	return false
}

// IsCloud returns true when the server is on cloud, and false otherwise.
func IsCloud(license *model.License) bool {
	if license == nil || license.Features == nil || license.Features.Cloud == nil {
		return false
	}

	return *license.Features.Cloud
}
