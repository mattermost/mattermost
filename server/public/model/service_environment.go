// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"os"
	"strings"
)

const (
	// ServiceEnvironmentProduction represents the production self-managed or cloud
	// environments. This can be configured explicitly with MM_SERVICEENVIRONMENT explicitly
	// set to "production", but is also the default for any production builds.
	ServiceEnvironmentProduction = "production"
	// ServiceEnvironmentTest represents testing and development environments. This can be
	// configured explicitly with MM_SERVICEENVIRONMENT set to "test", but is also the default
	// for any non-production builds.
	ServiceEnvironmentTest = "test"
)

// GetServiceEnvironment returns the currently configured external service environment,
// deciding which public key is used to validate enterprise licenses, which telemetry keys are
// active, and which Stripe keys are in use.
//
// To configure an environment other than default, set MM_SERVICEENVIRONMENT before
// starting the application. Production builds default to ServiceEnvironmentProduction, and
// non-production builds default to ServiceEnvironmentTest.
//
// Note that this configuration is explicitly not part of the model.Config data structure, as it
// should never be persisted to the config store nor accidentally configured in any other way than
// the MM_SERVICEENVIRONMENT variable.
func GetServiceEnvironment() string {
	externalServiceEnvironment := strings.TrimSpace(strings.ToLower(os.Getenv("MM_SERVICEENVIRONMENT")))

	switch externalServiceEnvironment {
	case ServiceEnvironmentProduction, ServiceEnvironmentTest:
		return externalServiceEnvironment
	}

	return getDefaultServiceEnvironment()
}
