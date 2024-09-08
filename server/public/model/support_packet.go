// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
)

const (
	SupportPacketErrorFile = "warning.txt"
)

type SupportPacket struct {
	/* Build information */

	ServerOS           string `yaml:"server_os"`
	ServerArchitecture string `yaml:"server_architecture"`
	ServerVersion      string `yaml:"server_version"`
	BuildHash          string `yaml:"build_hash"`

	/* DB */

	DatabaseType          string `yaml:"database_type"`
	DatabaseVersion       string `yaml:"database_version"`
	DatabaseSchemaVersion string `yaml:"database_schema_version"`
	WebsocketConnections  int    `yaml:"websocket_connections"`
	MasterDbConnections   int    `yaml:"master_db_connections"`
	ReplicaDbConnections  int    `yaml:"read_db_connections"`

	/* Cluster */

	ClusterID string `yaml:"cluster_id"`

	/* File store */

	FileDriver string `yaml:"file_driver"`
	FileStatus string `yaml:"file_status"`

	/* LDAP */

	LdapVendorName    string `yaml:"ldap_vendor_name,omitempty"`
	LdapVendorVersion string `yaml:"ldap_vendor_version,omitempty"`

	/* Elastic Search */

	ElasticServerVersion string   `yaml:"elastic_server_version,omitempty"`
	ElasticServerPlugins []string `yaml:"elastic_server_plugins,omitempty"`

	/* License */

	LicenseTo             string `yaml:"license_to"`
	LicenseSupportedUsers int    `yaml:"license_supported_users"`
	LicenseIsTrial        bool   `yaml:"license_is_trial,omitempty"`

	/* Server stats */

	ActiveUsers        int `yaml:"active_users"`
	DailyActiveUsers   int `yaml:"daily_active_users"`
	MonthlyActiveUsers int `yaml:"monthly_active_users"`
	InactiveUserCount  int `yaml:"inactive_user_count"`
	TotalPosts         int `yaml:"total_posts"`
	TotalChannels      int `yaml:"total_channels"`
	TotalTeams         int `yaml:"total_teams"`

	/* Jobs */

	DataRetentionJobs          []*Job `yaml:"data_retention_jobs"`
	MessageExportJobs          []*Job `yaml:"message_export_jobs"`
	ElasticPostIndexingJobs    []*Job `yaml:"elastic_post_indexing_jobs"`
	ElasticPostAggregationJobs []*Job `yaml:"elastic_post_aggregation_jobs"`
	BlevePostIndexingJobs      []*Job `yaml:"bleve_post_indexin_jobs"`
	LdapSyncJobs               []*Job `yaml:"ldap_sync_jobs"`
	MigrationJobs              []*Job `yaml:"migration_jobs"`
}

type FileData struct {
	Filename string
	Body     []byte
}

type SupportPacketOptions struct {
	IncludeLogs   bool     `json:"include_logs"`   // IncludeLogs is the option to include server logs
	PluginPackets []string `json:"plugin_packets"` // PluginPackets is a list of pluginids to call hooks
}

// SupportPacketOptionsFromReader decodes a json-encoded request from the given io.Reader.
func SupportPacketOptionsFromReader(reader io.Reader) (*SupportPacketOptions, error) {
	var r *SupportPacketOptions
	err := json.NewDecoder(reader).Decode(&r)
	if err != nil {
		return nil, err
	}

	return r, nil
}
