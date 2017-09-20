// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"io/ioutil"
	"net/http"
	"sync"

	"github.com/mattermost/mattermost-server/einterfaces"
	"github.com/mattermost/mattermost-server/plugin/pluginenv"
)

type App struct {
	Srv *Server

	PluginEnv              *pluginenv.Environment
	PluginConfigListenerId string

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

var globalApp App

var initEnterprise sync.Once

func Global() *App {
	initEnterprise.Do(func() {
		globalApp.AccountMigration = einterfaces.GetAccountMigrationInterface()
		globalApp.Brand = einterfaces.GetBrandInterface()
		globalApp.Cluster = einterfaces.GetClusterInterface()
		globalApp.Compliance = einterfaces.GetComplianceInterface()
		globalApp.Elasticsearch = einterfaces.GetElasticsearchInterface()
		globalApp.Ldap = einterfaces.GetLdapInterface()
		globalApp.Metrics = einterfaces.GetMetricsInterface()
		globalApp.Mfa = einterfaces.GetMfaInterface()
		globalApp.Saml = einterfaces.GetSamlInterface()
	})
	return &globalApp
}

func CloseBody(r *http.Response) {
	if r.Body != nil {
		ioutil.ReadAll(r.Body)
		r.Body.Close()
	}
}
