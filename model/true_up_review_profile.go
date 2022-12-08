// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type TrueUpReviewProfile struct {
	ServerId               string              `json:"server_id"`
	ServerVersion          string              `json:"server_version"`
	CustomerName           string              `json:"customer_name"`
	LicenseId              string              `json:"licnes_id"`
	LicnesedSeats          int                 `json:"license_seats"`
	LicensePlan            string              `json:"license_plan"`
	ActiveUsers            int                 `json:"active_users"`
	AuthenticationFeatures []string            `json:"authentication_features"`
	Plugins                TrueUpReviewPlugins `json:"plugins"`
	TotalWebhooks          int                 `json:"webhooks_count"`
	TotalPlaybooks         int                 `json:"playbooks_count"`
	TotalBoards            int                 `json:"boards_count"`
	TotalCalls             int                 `json:"calls_count"`
}

type TrueUpReviewPlugins struct {
	TotalPlugins int      `json:"total_plugins"`
	PluginNames  []string `json:"plugin_names"`
}
