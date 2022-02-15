// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	ejobs "github.com/mattermost/mattermost-server/v6/einterfaces/jobs"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/searchengine"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

var accountMigrationInterface func(*App) einterfaces.AccountMigrationInterface

func RegisterAccountMigrationInterface(f func(*App) einterfaces.AccountMigrationInterface) {
	accountMigrationInterface = f
}

var clusterInterface func(*Server) einterfaces.ClusterInterface

func RegisterClusterInterface(f func(*Server) einterfaces.ClusterInterface) {
	clusterInterface = f
}

var complianceInterface func(*App) einterfaces.ComplianceInterface

func RegisterComplianceInterface(f func(*App) einterfaces.ComplianceInterface) {
	complianceInterface = f
}

var dataRetentionInterface func(*App) einterfaces.DataRetentionInterface

func RegisterDataRetentionInterface(f func(*App) einterfaces.DataRetentionInterface) {
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

var jobsElasticsearchIndexerInterface func(*Server) ejobs.IndexerJobInterface

func RegisterJobsElasticsearchIndexerInterface(f func(*Server) ejobs.IndexerJobInterface) {
	jobsElasticsearchIndexerInterface = f
}

var jobsLdapSyncInterface func(*Server) ejobs.LdapSyncInterface

func RegisterJobsLdapSyncInterface(f func(*Server) ejobs.LdapSyncInterface) {
	jobsLdapSyncInterface = f
}

var jobsCloudInterface func(*Server) ejobs.CloudJobInterface

func RegisterJobsCloudInterface(f func(*Server) ejobs.CloudJobInterface) {
	jobsCloudInterface = f
}

var ldapInterface func(*Server) einterfaces.LdapInterface

func RegisterLdapInterface(f func(*Server) einterfaces.LdapInterface) {
	ldapInterface = f
}

var messageExportInterface func(*App) einterfaces.MessageExportInterface

func RegisterMessageExportInterface(f func(*App) einterfaces.MessageExportInterface) {
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

	if clusterInterface != nil {
		s.Cluster = clusterInterface(s)
	}
	if elasticsearchInterface != nil {
		s.SearchEngine.RegisterElasticsearchEngine(elasticsearchInterface(s))
	}

	if licenseInterface != nil {
		s.LicenseManager = licenseInterface(s)
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

	if cloudInterface != nil {
		s.Cloud = cloudInterface(s)
	}
}
