// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type BridgeAgentInfo struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Username    string `json:"username"`
	ServiceID   string `json:"service_id"`
	ServiceType string `json:"service_type"`
	IsDefault   bool   `json:"is_default,omitempty"`
}

type BridgeServiceInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

type AgentsIntegrityResponse struct {
	Available bool   `json:"available"`
	Reason    string `json:"reason,omitempty"`
}
