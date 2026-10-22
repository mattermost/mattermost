// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package telemetry

import (
	"model"
)

const (
	TrackConfigService       = "config_service"
	TrackConfigMessageExport = "config_message_export"
)

type ServerIface interface {
	Config() *model.Config
}

type TelemetryService struct {
	srv ServerIface
}

func (ts *TelemetryService) sendTelemetry(event string, properties map[string]interface{}) {
}

func isDefault(setting interface{}, defaultValue interface{}) bool {
	return setting == defaultValue
}

func (ts *TelemetryService) trackConfig() {
	cfg := ts.srv.Config()
	ts.sendTelemetry(TrackConfigService, map[string]interface{}{
		"tls_strict_transport":  *cfg.ServiceSettings.TLSStrictTransport,
		"tls_overwrite_ciphers": len(cfg.ServiceSettings.TLSOverwriteCiphers),
		"isdefault_site_url":    isDefault(*cfg.ServiceSettings.SiteURL, model.SERVICE_SETTINGS_DEFAULT_SITE_URL),
	})

	ts.sendTelemetry(TrackConfigMessageExport, map[string]interface{}{
		"default_export_from_timestamp":         *cfg.MessageExportSettings.ExportFromTimestamp + 1,
		"batch_size":                            (*cfg.MessageExportSettings.BatchSize == 0),
		"global_relay_customer_type":            *cfg.MessageExportSettings.GlobalRelaySettings.CustomerType,
		"is_default_global_relay_smtp_username": isDefault(cfg.MessageExportSettings.GlobalRelaySettings.SmtpUsername, ""),
	})
}
