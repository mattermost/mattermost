// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"math/big"
)

const (
	SystemServerId                         = "DiagnosticId"
	SystemRanUnitTests                     = "RanUnitTests"
	SystemLastSecurityTime                 = "LastSecurityTime"
	SystemActiveLicenseId                  = "ActiveLicenseId"
	SystemLastComplianceTime               = "LastComplianceTime"
	SystemAsymmetricSigningKeyKey          = "AsymmetricSigningKey"
	SystemPostActionCookieSecretKey        = "PostActionCookieSecret"
	SystemInstallationDateKey              = "InstallationDate"
	SystemOrganizationName                 = "OrganizationName"
	SystemFirstAdminRole                   = "FirstAdminRole"
	SystemFirstServerRunTimestampKey       = "FirstServerRunTimestamp"
	SystemClusterEncryptionKey             = "ClusterEncryptionKey"
	SystemUpgradedFromTeId                 = "UpgradedFromTE"
	SystemWarnMetricNumberOfTeams5         = "warn_metric_number_of_teams_5"
	SystemWarnMetricNumberOfChannels50     = "warn_metric_number_of_channels_50"
	SystemWarnMetricMfa                    = "warn_metric_mfa"
	SystemWarnMetricEmailDomain            = "warn_metric_email_domain"
	SystemWarnMetricNumberOfActiveUsers100 = "warn_metric_number_of_active_users_100"
	SystemWarnMetricNumberOfActiveUsers200 = "warn_metric_number_of_active_users_200"
	SystemWarnMetricNumberOfActiveUsers300 = "warn_metric_number_of_active_users_300"
	SystemWarnMetricNumberOfActiveUsers500 = "warn_metric_number_of_active_users_500"
	SystemWarnMetricNumberOfPosts2m        = "warn_metric_number_of_posts_2M"
	SystemWarnMetricLastRunTimestampKey    = "LastWarnMetricRunTimestamp"
	SystemFirstAdminVisitMarketplace       = "FirstAdminVisitMarketplace"
	SystemFirstAdminSetupComplete          = "FirstAdminSetupComplete"
	SystemLastAccessiblePostTime           = "LastAccessiblePostTime"
	SystemLastAccessibleFileTime           = "LastAccessibleFileTime"
	SystemHostedPurchaseNeedsScreening     = "HostedPurchaseNeedsScreening"
	AwsMeteringReportInterval              = 1
	AwsMeteringDimensionUsageHrs           = "UsageHrs"
	CloudRenewalEmail                      = "CloudRenewalEmail"
)

const (
	WarnMetricStatusLimitReached    = "true"
	WarnMetricStatusRunonce         = "runonce"
	WarnMetricStatusAck             = "ack"
	WarnMetricStatusStorePrefix     = "warn_metric_"
	WarnMetricJobInterval           = 24 * 7
	WarnMetricNumberOfActiveUsers25 = 25
	WarnMetricJobWaitTime           = 1000 * 3600 * 24 * 7 // 7 days
)

type System struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type SystemPostActionCookieSecret struct {
	Secret []byte `json:"key,omitempty"`
}

type SystemAsymmetricSigningKey struct {
	ECDSAKey *SystemECDSAKey `json:"ecdsa_key,omitempty"`
}

type SystemECDSAKey struct {
	Curve string   `json:"curve"`
	X     *big.Int `json:"x"`
	Y     *big.Int `json:"y"`
	D     *big.Int `json:"d,omitempty"`
}

// ServerBusyState provides serialization for app.Busy.
type ServerBusyState struct {
	Busy      bool   `json:"busy"`
	Expires   int64  `json:"expires"`
	ExpiresTS string `json:"expires_ts,omitempty"`
}

type AppliedMigration struct {
	Version int    `json:"version"`
	Name    string `json:"name"`
}

type LogFilter struct {
	ServerNames []string `json:"server_names"`
	LogLevels   []string `json:"log_levels"`
	DateFrom    string   `json:"date_from"`
	DateTo      string   `json:"date_to"`
}

type LogEntry struct {
	Timestamp string
	Level     string
}

// SystemPingOptions is the options for setting contents of the system ping
// response.
type SystemPingOptions struct {
	// FullStatus allows server to set the detailed information about
	// the system status.
	FullStatus bool
	// RestSemantics allows server to return 200 code even if the server
	// status is unhealthy.
	RESTSemantics bool
}
