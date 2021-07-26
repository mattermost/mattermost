// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	ejobs "github.com/mattermost/mattermost-server/v6/einterfaces/jobs"
	tjobs "github.com/mattermost/mattermost-server/v6/jobs/interfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/searchengine"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
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

var jobsElasticsearchIndexerInterface func(*Server) tjobs.IndexerJobInterface

func RegisterJobsElasticsearchIndexerInterface(f func(*Server) tjobs.IndexerJobInterface) {
	jobsElasticsearchIndexerInterface = f
}

var jobsLdapSyncInterface func(*Server) ejobs.LdapSyncInterface

func RegisterJobsLdapSyncInterface(f func(*Server) ejobs.LdapSyncInterface) {
	jobsLdapSyncInterface = f
}

var jobsMigrationsInterface func(*Server) tjobs.MigrationsJobInterface

func RegisterJobsMigrationsJobInterface(f func(*Server) tjobs.MigrationsJobInterface) {
	jobsMigrationsInterface = f
}

var jobsPluginsInterface func(*Server) tjobs.PluginsJobInterface

func RegisterJobsPluginsJobInterface(f func(*Server) tjobs.PluginsJobInterface) {
	jobsPluginsInterface = f
}

var jobsBleveIndexerInterface func(*Server) tjobs.IndexerJobInterface

func RegisterJobsBleveIndexerInterface(f func(*Server) tjobs.IndexerJobInterface) {
	jobsBleveIndexerInterface = f
}

var jobsActiveUsersInterface func(*Server) tjobs.ActiveUsersJobInterface

func RegisterJobsActiveUsersInterface(f func(*Server) tjobs.ActiveUsersJobInterface) {
	jobsActiveUsersInterface = f
}

var jobsResendInvitationEmailInterface func(*Server) ejobs.ResendInvitationEmailJobInterface

// RegisterJobsResendInvitationEmailInterface is used to register or initialize the jobsResendInvitationEmailInterface
func RegisterJobsResendInvitationEmailInterface(f func(*Server) ejobs.ResendInvitationEmailJobInterface) {
	jobsResendInvitationEmailInterface = f
}

var jobsCloudInterface func(*Server) ejobs.CloudJobInterface

func RegisterJobsCloudInterface(f func(*Server) ejobs.CloudJobInterface) {
	jobsCloudInterface = f
}

var jobsExpiryNotifyInterface func(*Server) tjobs.ExpiryNotifyJobInterface

func RegisterJobsExpiryNotifyJobInterface(f func(*Server) tjobs.ExpiryNotifyJobInterface) {
	jobsExpiryNotifyInterface = f
}

var jobsImportProcessInterface func(*Server) tjobs.ImportProcessInterface

func RegisterJobsImportProcessInterface(f func(*Server) tjobs.ImportProcessInterface) {
	jobsImportProcessInterface = f
}

var jobsImportDeleteInterface func(*Server) tjobs.ImportDeleteInterface

func RegisterJobsImportDeleteInterface(f func(*Server) tjobs.ImportDeleteInterface) {
	jobsImportDeleteInterface = f
}

var jobsExportProcessInterface func(*Server) tjobs.ExportProcessInterface

func RegisterJobsExportProcessInterface(f func(*Server) tjobs.ExportProcessInterface) {
	jobsExportProcessInterface = f
}

var jobsExportDeleteInterface func(*Server) tjobs.ExportDeleteInterface

func RegisterJobsExportDeleteInterface(f func(*Server) tjobs.ExportDeleteInterface) {
	jobsExportDeleteInterface = f
}

var productNoticesJobInterface func(*Server) tjobs.ProductNoticesJobInterface

func RegisterProductNoticesJobInterface(f func(*Server) tjobs.ProductNoticesJobInterface) {
	productNoticesJobInterface = f
}

var ldapInterface func(*Server) einterfaces.LdapInterface

func RegisterLdapInterface(f func(*Server) einterfaces.LdapInterface) {
	ldapInterface = f
}

var messageExportInterface func(*Server) einterfaces.MessageExportInterface

func RegisterMessageExportInterface(f func(*Server) einterfaces.MessageExportInterface) {
	messageExportInterface = f
}

var cloudInterface func(*Server) einterfaces.CloudInterface

func RegisterCloudInterface(f func(*Server) einterfaces.CloudInterface) {
	cloudInterface = f
}

var metricsInterface func(*Server) einterfaces.MetricsInterface

func RegisterMetricsInterface(f func(*Server) einterfaces.MetricsInterface) {
	metricsInterface = f
}

var samlInterfaceNew func(*Server) einterfaces.SamlInterface

func RegisterNewSamlInterface(f func(*Server) einterfaces.SamlInterface) {
	samlInterfaceNew = f
}

var notificationInterface func(*Server) einterfaces.NotificationInterface

func RegisterNotificationInterface(f func(*Server) einterfaces.NotificationInterface) {
	notificationInterface = f
}

var licenseInterface func(*Server) einterfaces.LicenseInterface

func RegisterLicenseInterface(f func(*Server) einterfaces.LicenseInterface) {
	licenseInterface = f
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

	if licenseInterface != nil {
		s.LicenseManager = licenseInterface(s)
	}

	if accountMigrationInterface != nil {
		s.AccountMigration = accountMigrationInterface(s)
	}
	if ldapInterface != nil {
		s.Ldap = ldapInterface(s)
	}
	if notificationInterface != nil {
		s.Notification = notificationInterface(s)
	}
	if samlInterfaceNew != nil {
		mlog.Debug("Loading SAML2 library")
		s.Saml = samlInterfaceNew(s)
		if err := s.Saml.ConfigureSP(); err != nil {
			mlog.Error("An error occurred while configuring SAML Service Provider", mlog.Err(err))
		}
		s.AddConfigListener(func(_, cfg *model.Config) {
			if err := s.Saml.ConfigureSP(); err != nil {
				mlog.Error("An error occurred while configuring SAML Service Provider", mlog.Err(err))
			}
		})
	}
}
