// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/http"
	"os"
)

const (
	CDSOfflineAfterMillis = 1000 * 60 * 30 // 30 minutes
	CDSTypeApp            = "mattermost_app"
)

type ClusterDiscovery struct {
	Id          string `json:"id"`
	Type        string `json:"type"`
	ClusterName string `json:"cluster_name"`
	Hostname    string `json:"hostname"`
	GossipPort  int32  `json:"gossip_port"`
	Port        int32  `json:"port"`
	CreateAt    int64  `json:"create_at"`
	LastPingAt  int64  `json:"last_ping_at"`
}

func (o *ClusterDiscovery) PreSave() {
	if o.Id == "" {
		o.Id = NewId()
	}

	if o.CreateAt == 0 {
		o.CreateAt = GetMillis()
		o.LastPingAt = o.CreateAt
	}
}

func (o *ClusterDiscovery) AutoFillHostname() {
	// attempt to set the hostname from the OS
	if o.Hostname == "" {
		if hn, err := os.Hostname(); err == nil {
			o.Hostname = hn
		}
	}
}

func (o *ClusterDiscovery) AutoFillIPAddress(iface string, ipAddress string) {
	// attempt to set the hostname to the first non-local IP address
	if o.Hostname == "" {
		if ipAddress != "" {
			o.Hostname = ipAddress
		} else {
			o.Hostname = GetServerIPAddress(iface)
		}
	}
}

func (o *ClusterDiscovery) IsEqual(in *ClusterDiscovery) bool {
	if in == nil {
		return false
	}

	if o.Type != in.Type {
		return false
	}

	if o.ClusterName != in.ClusterName {
		return false
	}

	if o.Hostname != in.Hostname {
		return false
	}

	return true
}

func FilterClusterDiscovery(vs []*ClusterDiscovery, f func(*ClusterDiscovery) bool) []*ClusterDiscovery {
	copy := make([]*ClusterDiscovery, 0)
	for _, v := range vs {
		if f(v) {
			copy = append(copy, v)
		}
	}

	return copy
}

func (o *ClusterDiscovery) IsValid() *AppError {
	if !IsValidId(o.Id) {
		return NewAppError("ClusterDiscovery.IsValid", "model.cluster.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if o.ClusterName == "" {
		return NewAppError("ClusterDiscovery.IsValid", "model.cluster.is_valid.name.app_error", nil, "", http.StatusBadRequest)
	}

	if o.Type == "" {
		return NewAppError("ClusterDiscovery.IsValid", "model.cluster.is_valid.type.app_error", nil, "", http.StatusBadRequest)
	}

	if o.Hostname == "" {
		return NewAppError("ClusterDiscovery.IsValid", "model.cluster.is_valid.hostname.app_error", nil, "", http.StatusBadRequest)
	}

	if o.CreateAt == 0 {
		return NewAppError("ClusterDiscovery.IsValid", "model.cluster.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if o.LastPingAt == 0 {
		return NewAppError("ClusterDiscovery.IsValid", "model.cluster.is_valid.last_ping_at.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}
