// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"os"
	"strings"
)

const (
	// ServiceEnvironmentEnterprise represents the self-managed environment. This can be
	// configured explicitly with MM_SERVICEENVIRONMENT explicitly set to "enterprise", but is
	// also the default for any production builds.
	ServiceEnvironmentEnterprise = "enterprise"
	// ServiceEnvironmentCloud represents the Mattermost Cloud environment in which
	// MM_SERVICEENVIRONMENT is explicitly set to "cloud".
	ServiceEnvironmentCloud = "cloud"
	// ServiceEnvironmentCloud represents testing environments within Mattermost in
	// which MM_SERVICEENVIRONMENT is explicitly set to "test".
	ServiceEnvironmentTest = "test"
	// ServiceEnvironmentDev represents development environments. This can be configured
	// explicitly with MM_SERVICEENVIRONMENT set to "dev", but is also the default for any
	// non-production builds.
	ServiceEnvironmentDev = "dev"
)

// GetServiceEnvironment returns the currently configured external service environment,
// deciding which public key is used to validate enterprise licenses, which telemetry keys are
// active, and which Stripe keys are in use.
//
// To configure an environment other than default, set MM_SERVICEENVIRONMENT before
// starting the application. Production builds default to ServiceEnvironmentEnterprise, and
// non-production builds default to ServiceEnvironmentDev.
//
// Note that this configuration is explicitly not part of the model.Config data structure, as it
// should never be persisted to the config store nor accidentally configured in any other way than
// the MM_SERVICEENVIRONMENT variable.
func GetServiceEnvironment() string {
	externalServiceEnvironment := strings.TrimSpace(strings.ToLower(os.Getenv("MM_SERVICEENVIRONMENT")))

	switch externalServiceEnvironment {
	case ServiceEnvironmentEnterprise, ServiceEnvironmentCloud, ServiceEnvironmentTest, ServiceEnvironmentDev:
		return externalServiceEnvironment
	}

	return getDefaultServiceEnvironment()
}
