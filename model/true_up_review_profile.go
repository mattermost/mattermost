// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type TrueUpReviewProfile struct {
	ServerId               string              `json:"server_id"`
	ServerVersion          string              `json:"server_version"`
	ServerInstallationType string              `json:"server_installation_type"`
	LicenseId              string              `json:"license_id"`
	LicensedSeats          int                 `json:"licensed_seats"`
	LicensePlan            string              `json:"license_plan"`
	CustomerName           string              `json:"customer_name"`
	ActiveUsers            int64               `json:"active_users"`
	AuthenticationFeatures []string            `json:"authentication_features"`
	Plugins                TrueUpReviewPlugins `json:"plugins"`
	TotalIncomingWebhooks  int64               `json:"incoming_webhooks_count"`
	TotalOutgoingWebhooks  int64               `json:"outgoing_webhooks_count"`
}

type TrueUpReviewPlugins struct {
	TotalActivePlugins   int      `json:"total_active_plugins"`
	TotalInactivePlugins int      `json:"total_inactive_plugins"`
	ActivePluginNames    []string `json:"active_plugin_names"`
	InactivePluginNames  []string `json:"inactive_plugin_names"`
}

func (t *TrueUpReviewPlugins) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"total_active_plugins":   t.TotalActivePlugins,
		"total_inactive_plugins": t.TotalInactivePlugins,
		"active_plugin_names":    t.ActivePluginNames,
		"inactive_plugin_names":  t.InactivePluginNames,
	}
}

type TrueUpReviewStatus struct {
	Completed bool  `json:"complete"`
	DueDate   int64 `json:"due_date"`
}

func (t *TrueUpReviewStatus) ToSlice() []interface{} {
	return []interface{}{
		t.DueDate,
		t.Completed,
	}
}
