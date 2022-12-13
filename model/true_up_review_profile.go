// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type TrueUpReviewProfile struct {
	ServerId               string              `json:"server_id"`
	ServerVersion          string              `json:"server_version"`
	ServerInstallationType string              `json:"server_installation_type"`
	LicenseId              string              `json:"licnes_id"`
	LicensedSeats          int                 `json:"licensed_seats"`
	LicensePlan            string              `json:"license_plan"`
	CustomerName           string              `json:"customer_name"`
	ActiveUsers            int64               `json:"active_users"`
	AuthenticationFeatures []string            `json:"authentication_features"`
	Plugins                TrueUpReviewPlugins `json:"plugins"`
	TotalWebhooks          int64               `json:"webhooks_count"`
	TotalPlaybooks         int                 `json:"playbooks_count"`
	TotalBoards            int                 `json:"boards_count"`
	TotalCalls             int                 `json:"calls_count"`
}

type TrueUpReviewPlugins struct {
	TotalActivePlugins   int      `json:"total_active_plugins"`
	TotalInactivePlugins int      `json:"total_inactive_plugins"`
	ActivePluginNames    []string `json:"active_plugin_names"`
	InactivePluginNames  []string `json:"inactive_plugin_names"`
}
