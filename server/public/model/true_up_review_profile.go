// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "strings"

type TrueUpReviewProfile struct {
	ServerId               string              `json:"server_id"`
	ServerVersion          string              `json:"server_version"`
	ServerInstallationType string              `json:"server_installation_type"`
	LicenseId              string              `json:"license_id"`
	LicensedSeats          int                 `json:"licensed_seats"`
	LicensePlan            string              `json:"license_plan"`
	CustomerName           string              `json:"customer_name"`
	ActivatedUsers         int64               `json:"total_activated_users"`
	DailyActiveUsers       int64               `json:"daily_active_users"`
	MonthlyActiveUsers     int64               `json:"monthly_active_users"`
	AuthenticationFeatures []string            `json:"authentication_features"`
	Plugins                TrueUpReviewPlugins `json:"plugins"`
	TotalIncomingWebhooks  int64               `json:"incoming_webhooks_count"`
	TotalOutgoingWebhooks  int64               `json:"outgoing_webhooks_count"`
}

type TrueUpReviewPlugins struct {
	TotalPlugins int      `json:"total_plugins"`
	PluginNames  []string `json:"plugin_names"`
}

func (t *TrueUpReviewPlugins) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"total_plugins": t.TotalPlugins,
		"plugin_names":  strings.Join(t.PluginNames, ","),
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
