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

var accountMigrationInterface func(*App) einterfaces.AccountMigrationInterface

func RegisterAccountMigrationInterface(f func(*App) einterfaces.AccountMigrationInterface) {
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

var jobsElasticsearchIndexerInterface func(*Server) tjobs.IndexerJobInterface

func RegisterJobsElasticsearchIndexerInterface(f func(*Server) tjobs.IndexerJobInterface) {
	jobsElasticsearchIndexerInterface = f
}

var jobsLdapSyncInterface func(*App) ejobs.LdapSyncInterface

func RegisterJobsLdapSyncInterface(f func(*App) ejobs.LdapSyncInterface) {
	jobsLdapSyncInterface = f
}

var jobsMigrationsInterface func(*Server) tjobs.MigrationsJobInterface

func RegisterJobsMigrationsJobInterface(f func(*Server) tjobs.MigrationsJobInterface) {
	jobsMigrationsInterface = f
}

var jobsPluginsInterface func(*App) tjobs.PluginsJobInterface

func RegisterJobsPluginsJobInterface(f func(*App) tjobs.PluginsJobInterface) {
	jobsPluginsInterface = f
}

var jobsBleveIndexerInterface func(*Server) tjobs.IndexerJobInterface

func RegisterJobsBleveIndexerInterface(f func(*Server) tjobs.IndexerJobInterface) {
	jobsBleveIndexerInterface = f
}

var jobsActiveUsersInterface func(*App) tjobs.ActiveUsersJobInterface

func RegisterJobsActiveUsersInterface(f func(*App) tjobs.ActiveUsersJobInterface) {
	jobsActiveUsersInterface = f
}

var jobsExpiryNotifyInterface func(*App) tjobs.ExpiryNotifyJobInterface

func RegisterJobsExpiryNotifyJobInterface(f func(*App) tjobs.ExpiryNotifyJobInterface) {
	jobsExpiryNotifyInterface = f
}

var productNoticesJobInterface func(*App) tjobs.ProductNoticesJobInterface

func RegisterProductNoticesJobInterface(f func(*App) tjobs.ProductNoticesJobInterface) {
	productNoticesJobInterface = f
}

var ldapInterface func(*App) einterfaces.LdapInterface

func RegisterLdapInterface(f func(*App) einterfaces.LdapInterface) {
	ldapInterface = f
}

var messageExportInterface func(*Server) einterfaces.MessageExportInterface

func RegisterMessageExportInterface(f func(*Server) einterfaces.MessageExportInterface) {
	messageExportInterface = f
}

var cloudInterface func(*App) einterfaces.CloudInterface

func RegisterCloudInterface(f func(*App) einterfaces.CloudInterface) {
	cloudInterface = f
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
	if complianceInterface != nil {
		s.Compliance = complianceInterface(s)
	}
	if messageExportInterface != nil {
		s.MessageExport = messageExportInterface(s)
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

func (a *App) initEnterprise() {
	if accountMigrationInterface != nil {
		a.srv.AccountMigration = accountMigrationInterface(a)
	}
	if ldapInterface != nil {
		a.srv.Ldap = ldapInterface(a)
	}
	if notificationInterface != nil {
		a.srv.Notification = notificationInterface(a)
	}
	if samlInterface != nil {
		if *a.Config().ExperimentalSettings.UseNewSAMLLibrary && samlInterfaceNew != nil {
			mlog.Debug("Loading new SAML2 library")
			a.srv.Saml = samlInterfaceNew(a)
		} else if *a.Config().ExperimentalSettings.UseNewSAMLLibrary && samlInterfaceNew == nil {
			mlog.Debug("Ignoring configuration setting to use the Experimental SAML library")
			a.srv.Saml = samlInterface(a)
		} else {
			mlog.Debug("Loading original SAML library")
			a.srv.Saml = samlInterface(a)
		}
		if err := a.srv.Saml.ConfigureSP(); err != nil {
			mlog.Error("An error occurred while configuring SAML Service Provider", mlog.Err(err))
		}
		a.AddConfigListener(func(_, cfg *model.Config) {
			if err := a.srv.Saml.ConfigureSP(); err != nil {
				mlog.Error("An error occurred while configuring SAML Service Provider", mlog.Err(err))
			}
		})
	}
	if cloudInterface != nil {
		a.srv.Cloud = cloudInterface(a)
	}
}
