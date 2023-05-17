package model

import (
	"os"
	"strings"
)

const (
	// ExternalServiceEnvironmentDefault represents the self-managed environment in which no
	// explicit configuration is present.
	ExternalServiceEnvironmentDefault = ""
	// ExternalServiceEnvironmentCloud represents the Mattermost Cloud environment in which
	// MM_EXTERNALSERVICEENVIRONMENT is explicitly set to "cloud".
	ExternalServiceEnvironmentCloud = "cloud"
	// ExternalServiceEnvironmentCloud represents testing environments within Mattermost in
	// which MM_EXTERNALSERVICEENVIRONMENT is explicitly set to "test".
	ExternalServiceEnvironmentTest = "test"
	// ExternalServiceEnvironmentDev represents development environments in which the build
	// number is empty or set to "dev". This prevents unintentionally using production keys
	// while preserving the default behaviour for the self-managed environment.
	ExternalServiceEnvironmentDev = "dev"
)

// GetExternalServiceEnvironment returns the currently configured external service environment,
// deciding which public key is used to validate enterprise licenses, which telemetry keys are
// active, and which Stripe keys are in use.
//
// To configure an environment other than default, set MM_EXTERNALSERVICEENVIRONMENT before
// starting the application. Only production builds -- with a non-empty, non-"dev" build number --
// honour this environment variable, as dev builds will force the "dev" environment.
//
// Note that this configuration is explicitly not part of the model.Config data structure, as it
// should never be persisted to the config store nor accidentally configured in any other way than
// the MM_EXTERNALSERVICEENVIRONMENT variable.
func GetExternalServiceEnvironment() string {
	// Force the test environment unless a production build number is provided.
	if BuildNumber == "" || BuildNumber == "dev" {
		return ExternalServiceEnvironmentDev
	}

	externalServiceEnvironment := strings.TrimSpace(strings.ToLower(os.Getenv("MM_EXTERNALSERVICEENVIRONMENT")))

	switch externalServiceEnvironment {
	case ExternalServiceEnvironmentDefault, ExternalServiceEnvironmentCloud, ExternalServiceEnvironmentTest:
		return externalServiceEnvironment
	}

	return ExternalServiceEnvironmentDefault
}
