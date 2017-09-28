// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"io/ioutil"
	"net/http"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/einterfaces"
	ejobs "github.com/mattermost/mattermost-server/einterfaces/jobs"
	"github.com/mattermost/mattermost-server/jobs"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin/pluginenv"
	"github.com/mattermost/mattermost-server/utils"
)

type App struct {
	Srv *Server

	PluginEnv              *pluginenv.Environment
	PluginConfigListenerId string

	EmailBatching *EmailBatchingJob

	Hubs                        []*Hub
	HubsStopCheckingForDeadlock chan bool

	Jobs *jobs.JobServer

	AccountMigration einterfaces.AccountMigrationInterface
	Brand            einterfaces.BrandInterface
	Cluster          einterfaces.ClusterInterface
	Compliance       einterfaces.ComplianceInterface
	Elasticsearch    einterfaces.ElasticsearchInterface
	Ldap             einterfaces.LdapInterface
	Metrics          einterfaces.MetricsInterface
	Mfa              einterfaces.MfaInterface
	Saml             einterfaces.SamlInterface
}

var globalApp App = App{
	Jobs: &jobs.JobServer{},
}

var appCount = 0
var initEnterprise sync.Once

var UseGlobalApp = true

// New creates a new App. You must call Shutdown when you're done with it.
// XXX: Doesn't necessarily create a new App yet.
func New() *App {
	appCount++

	if !UseGlobalApp {
		if appCount > 1 {
			panic("Only one App should exist at a time. Did you forget to call Shutdown()?")
		}
		app := &App{
			Jobs: &jobs.JobServer{},
		}
		app.initEnterprise()
		return app
	}

	initEnterprise.Do(func() {
		globalApp.initEnterprise()
	})
	return &globalApp
}

func (a *App) Shutdown() {
	appCount--
	if appCount == 0 {
		// XXX: This is to give all of our runaway goroutines time to complete.
		//      We should wrangle them up and remove this.
		time.Sleep(time.Millisecond * 500)

		if a.Srv != nil {
			a.StopServer()
		}
	}
}

var accountMigrationInterface func(*App) einterfaces.AccountMigrationInterface

func RegisterAccountMigrationInterface(f func(*App) einterfaces.AccountMigrationInterface) {
	accountMigrationInterface = f
}

var clusterInterface func(*App) einterfaces.ClusterInterface

func RegisterClusterInterface(f func(*App) einterfaces.ClusterInterface) {
	clusterInterface = f
}

var complianceInterface func(*App) einterfaces.ComplianceInterface

func RegisterComplianceInterface(f func(*App) einterfaces.ComplianceInterface) {
	complianceInterface = f
}

var jobsDataRetentionInterface func(*App) ejobs.DataRetentionInterface

func RegisterJobsDataRetentionInterface(f func(*App) ejobs.DataRetentionInterface) {
	jobsDataRetentionInterface = f
}

var jobsElasticsearchAggregatorInterface func(*App) ejobs.ElasticsearchAggregatorInterface

func RegisterJobsElasticsearchAggregatorInterface(f func(*App) ejobs.ElasticsearchAggregatorInterface) {
	jobsElasticsearchAggregatorInterface = f
}

var jobsElasticsearchIndexerInterface func(*App) ejobs.ElasticsearchIndexerInterface

func RegisterJobsElasticsearchIndexerInterface(f func(*App) ejobs.ElasticsearchIndexerInterface) {
	jobsElasticsearchIndexerInterface = f
}

var jobsLdapSyncInterface func(*App) ejobs.LdapSyncInterface

func RegisterJobsLdapSyncInterface(f func(*App) ejobs.LdapSyncInterface) {
	jobsLdapSyncInterface = f
}

var ldapInterface func(*App) einterfaces.LdapInterface

func RegisterLdapInterface(f func(*App) einterfaces.LdapInterface) {
	ldapInterface = f
}

var metricsInterface func(*App) einterfaces.MetricsInterface

func RegisterMetricsInterface(f func(*App) einterfaces.MetricsInterface) {
	metricsInterface = f
}

var mfaInterface func(*App) einterfaces.MfaInterface

func RegisterMfaInterface(f func(*App) einterfaces.MfaInterface) {
	mfaInterface = f
}

var samlInterface func(*App) einterfaces.SamlInterface

func RegisterSamlInterface(f func(*App) einterfaces.SamlInterface) {
	samlInterface = f
}

func (a *App) initEnterprise() {
	if accountMigrationInterface != nil {
		a.AccountMigration = accountMigrationInterface(a)
	}
	a.Brand = einterfaces.GetBrandInterface()
	if clusterInterface != nil {
		a.Cluster = clusterInterface(a)
	}
	if complianceInterface != nil {
		a.Compliance = complianceInterface(a)
	}
	a.Elasticsearch = einterfaces.GetElasticsearchInterface()
	if ldapInterface != nil {
		a.Ldap = ldapInterface(a)
		utils.AddConfigListener(func(_, cfg *model.Config) {
			if err := utils.ValidateLdapFilter(cfg, a.Ldap); err != nil {
				panic(utils.T(err.Id))
			}
		})
	}
	if metricsInterface != nil {
		a.Metrics = metricsInterface(a)
	}
	if mfaInterface != nil {
		a.Mfa = mfaInterface(a)
	}
	if samlInterface != nil {
		a.Saml = samlInterface(a)
		utils.AddConfigListener(func(_, cfg *model.Config) {
			a.Saml.ConfigureSP()
		})
	}

	if jobsDataRetentionInterface != nil {
		a.Jobs.DataRetention = jobsDataRetentionInterface(a)
	}
	if jobsElasticsearchAggregatorInterface != nil {
		a.Jobs.ElasticsearchAggregator = jobsElasticsearchAggregatorInterface(a)
	}
	if jobsElasticsearchIndexerInterface != nil {
		a.Jobs.ElasticsearchIndexer = jobsElasticsearchIndexerInterface(a)
	}
	if jobsLdapSyncInterface != nil {
		a.Jobs.LdapSync = jobsLdapSyncInterface(a)
	}
}

func (a *App) Config() *model.Config {
	return utils.Cfg
}

func CloseBody(r *http.Response) {
	if r.Body != nil {
		ioutil.ReadAll(r.Body)
		r.Body.Close()
	}
}
