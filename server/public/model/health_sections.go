// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

type NodeSection string

type WorkspaceSection string

const (
	SectionLicense          NodeSection = "license"
	SectionServerSoftware   NodeSection = "server_software"
	SectionServerHost       NodeSection = "server_host"
	SectionServerFDs        NodeSection = "server_fds"
	SectionConfigSource     NodeSection = "config_source"
	SectionDatabaseIdentity NodeSection = "database_identity"
	SectionDatabasePool     NodeSection = "database_pool"
	SectionDatabaseStats    NodeSection = "database_stats"
	SectionWebsocket        NodeSection = "websocket"
	SectionCluster          NodeSection = "cluster"
	SectionSearchEngine     NodeSection = "search_engine"
	SectionFilestoreDisk    NodeSection = "filestore_disk"
	SectionFilestoreConn    NodeSection = "filestore_connection"
	SectionLDAPProbe        NodeSection = "ldap_probe"
	SectionSAMLProbe        NodeSection = "saml_probe"
	SectionSearchProbe      NodeSection = "search_probe"
	SectionSMTPProbe        NodeSection = "smtp_probe"
	SectionOAuthProbes      NodeSection = "oauth_probes"
	SectionPushProbe        NodeSection = "push_probe"

	SectionStats   WorkspaceSection = "stats"
	SectionJobs    WorkspaceSection = "jobs"
	SectionPlugins WorkspaceSection = "plugins"
	SectionConfig  WorkspaceSection = "config"
	SectionVersion WorkspaceSection = "version"
)

func AllNodeSections() []NodeSection {
	return []NodeSection{
		SectionLicense,
		SectionServerSoftware,
		SectionServerHost,
		SectionServerFDs,
		SectionConfigSource,
		SectionDatabaseIdentity,
		SectionDatabasePool,
		SectionDatabaseStats,
		SectionWebsocket,
		SectionCluster,
		SectionSearchEngine,
		SectionFilestoreDisk,
		SectionFilestoreConn,
		SectionLDAPProbe,
		SectionSAMLProbe,
		SectionSearchProbe,
		SectionSMTPProbe,
		SectionOAuthProbes,
		SectionPushProbe,
	}
}

func AllWorkspaceSections() []WorkspaceSection {
	return []WorkspaceSection{
		SectionStats,
		SectionJobs,
		SectionPlugins,
		SectionConfig,
		SectionVersion,
	}
}
