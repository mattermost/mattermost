// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v5/einterfaces"
	ejobs "github.com/mattermost/mattermost-server/v5/einterfaces/jobs"
	tjobs "github.com/mattermost/mattermost-server/v5/jobs/interfaces"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/searchengine"
)

var accountMigrationInterface func(*Server) einterfaces.AccountMigrationInterface

func RegisterAccountMigrationInterface(f func(*Server) einterfaces.AccountMigrationInterface) {
	accountMigrationInterface = f
}

var clusterInterface func(*Server) einterfaces.ClusterInterface

func RegisterClusterInterface(f func(*Server) einterfaces.ClusterInterface) {
	clusterInterface = f
}

var complianceInterface func(*Server) einterfaces.ComplianceInterface

func RegisterComplianceInterface(f func(*Server) einterfaces.ComplianceInterface) {
	complianceInterface = f
}

var dataRetentionInterface func(*Server) einterfaces.DataRetentionInterface

func RegisterDataRetentionInterface(f func(*Server) einterfaces.DataRetentionInterface) {
	dataRetentionInterface = f
}

var elasticsearchInterface func(*Server) searchengine.SearchEngineInterface

func RegisterElasticsearchInterface(f func(*Server) searchengine.SearchEngineInterface) {
	elasticsearchInterface = f
}

var jobsDataRetentionJobInterface func(*Server) ejobs.DataRetentionJobInterface

func RegisterJobsDataRetentionJobInterface(f func(*Server) ejobs.DataRetentionJobInterface) {
	jobsDataRetentionJobInterface = f
}

var jobsMessageExportJobInterface func(*Server) ejobs.MessageExportJobInterface

func RegisterJobsMessageExportJobInterface(f func(*Server) ejobs.MessageExportJobInterface) {
	jobsMessageExportJobInterface = f
}

var jobsElasticsearchAggregatorInterface func(*Server) ejobs.ElasticsearchAggregatorInterface

func RegisterJobsElasticsearchAggregatorInterface(f func(*Server) ejobs.ElasticsearchAggregatorInterface) {
	jobsElasticsearchAggregatorInterface = f
}

var jobsElasticsearchIndexerInterface func(*Server) ejobs.ElasticsearchIndexerInterface

func RegisterJobsElasticsearchIndexerInterface(f func(*Server) ejobs.ElasticsearchIndexerInterface) {
	jobsElasticsearchIndexerInterface = f
}

var jobsLdapSyncInterface func(*App) ejobs.LdapSyncInterface

func RegisterJobsLdapSyncInterface(f func(*App) ejobs.LdapSyncInterface) {
	jobsLdapSyncInterface = f
}

var jobsMigrationsInterface func(*App) tjobs.MigrationsJobInterface

func RegisterJobsMigrationsJobInterface(f func(*App) tjobs.MigrationsJobInterface) {
	jobsMigrationsInterface = f
}

var jobsPluginsInterface func(*App) tjobs.PluginsJobInterface

func RegisterJobsPluginsJobInterface(f func(*App) tjobs.PluginsJobInterface) {
	jobsPluginsInterface = f
}

var ldapInterface func(*App) einterfaces.LdapInterface

func RegisterLdapInterface(f func(*App) einterfaces.LdapInterface) {
	ldapInterface = f
}

var messageExportInterface func(*Server) einterfaces.MessageExportInterface

func RegisterMessageExportInterface(f func(*Server) einterfaces.MessageExportInterface) {
	messageExportInterface = f
}

var metricsInterface func(*Server) einterfaces.MetricsInterface

func RegisterMetricsInterface(f func(*Server) einterfaces.MetricsInterface) {
	metricsInterface = f
}

var samlInterface func(*App) einterfaces.SamlInterface

func RegisterSamlInterface(f func(*App) einterfaces.SamlInterface) {
	samlInterface = f
}

var samlInterfaceNew func(*App) einterfaces.SamlInterface

func RegisterNewSamlInterface(f func(*App) einterfaces.SamlInterface) {
	samlInterfaceNew = f
}

var notificationInterface func(*App) einterfaces.NotificationInterface

func RegisterNotificationInterface(f func(*App) einterfaces.NotificationInterface) {
	notificationInterface = f
}

func (s *Server) initEnterprise() {
	if metricsInterface != nil {
		s.Metrics = metricsInterface(s)
	}
	if accountMigrationInterface != nil {
		s.AccountMigration = accountMigrationInterface(s)
	}
	if complianceInterface != nil {
		s.Compliance = complianceInterface(s)
	}
	if ldapInterface != nil {
		s.Ldap = ldapInterface(s.FakeApp())
	}
	if messageExportInterface != nil {
		s.MessageExport = messageExportInterface(s)
	}
	if notificationInterface != nil {
		s.Notification = notificationInterface(s.FakeApp())
	}
	if samlInterface != nil {
		if *s.FakeApp().Config().ExperimentalSettings.UseNewSAMLLibrary && samlInterfaceNew != nil {
			mlog.Debug("Loading new SAML2 library")
			s.Saml = samlInterfaceNew(s.FakeApp())
		} else {
			mlog.Debug("Loading original SAML library")
			s.Saml = samlInterface(s.FakeApp())
		}
		s.AddConfigListener(func(_, cfg *model.Config) {
			if err := s.Saml.ConfigureSP(); err != nil {
				mlog.Error("An error occurred while configuring SAML Service Provider", mlog.Err(err))
			}
		})
	}
	if dataRetentionInterface != nil {
		s.DataRetention = dataRetentionInterface(s)
	}
	if clusterInterface != nil {
		s.Cluster = clusterInterface(s)
	}

	if elasticsearchInterface != nil {
		s.SearchEngine.RegisterElasticsearchEngine(elasticsearchInterface(s))
	}
}
