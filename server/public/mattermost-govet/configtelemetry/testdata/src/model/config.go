// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

const (
	SERVICE_SETTINGS_DEFAULT_SITE_URL = "http://localhost:8065"
)

type ServiceSettings struct {
	SiteURL                  *string  `access:"environment,authentication,write_restrictable"`
	WebsocketURL             *string  `access:"write_restrictable,cloud_restrictable"`             // want `ServiceSettings.WebsocketURL is not used in telemetry`
	LicenseFileLocation      *string  `access:"write_restrictable,cloud_restrictable"`             // want `ServiceSettings.LicenseFileLocation is not used in telemetry`
	ListenAddress            *string  `access:"environment,write_restrictable,cloud_restrictable"` // telemetry: none
	TLSStrictTransport       *bool    `access:"write_restrictable,cloud_restrictable"`
	TLSStrictTransportMaxAge *int64   `access:"write_restrictable,cloud_restrictable"` // telemetry: none
	TLSOverwriteCiphers      []string `access:"write_restrictable,cloud_restrictable"`
	TrustedProxyIPHeader     []string `access:"write_restrictable,cloud_restrictable"` // telemetry: none

}

type GlobalRelayMessageExportSettings struct {
	CustomerType      *string `access:"compliance"` // must be either A9 or A10, dictates SMTP server url
	SmtpUsername      string  `access:"compliance"`
	SMTPServerTimeout *int    `access:"compliance"` // want `MessageExportSettings.GlobalRelaySettings.SMTPServerTimeout is not used in telemetry`
}

type MessageExportSettings struct {
	ExportFromTimestamp *int64 `access:"compliance"`
	BatchSize           *int   `access:"compliance"`

	// formatter-specific settings - these are only expected to be non-nil if ExportFormat is set to the associated format
	GlobalRelaySettings *GlobalRelayMessageExportSettings `access:"compliance"`
}

type CloudSettings struct {
	CWSUrl *string `access:"environment,write_restrictable"` // want `CloudSettings.CWSUrl is not used in telemetry`
}

type Config struct {
	ServiceSettings       ServiceSettings
	MessageExportSettings MessageExportSettings
	CloudSettings         CloudSettings
}
