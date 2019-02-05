// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/store"
)

type Option func(s *Server)

// By default, the app will use the store specified by the configuration. This allows you to
// construct an app with a different store.
//
// The override parameter must be either a store.Store or func(App) store.Store.
func StoreOverride(override interface{}) Option {
	return func(s *Server) {
		switch o := override.(type) {
		case store.Store:
			s.newStore = func() store.Store {
				return o
			}
		case func(*Server) store.Store:
			s.newStore = func() store.Store {
				return o(s)
			}
		default:
			panic("invalid StoreOverride")
		}
	}
}

func ConfigFile(file string, watch bool) Option {
	return func(s *Server) {
		s.configFile = file
		s.disableConfigWatch = !watch
	}
}

func RunJobs(s *Server) {
	s.runjobs = true
}

func JoinCluster(s *Server) {
	s.joinCluster = true
}

func StartMetrics(s *Server) {
	s.startMetrics = true
}

func StartElasticsearch(s *Server) {
	s.startElasticsearch = true
}

type AppOption func(a *App)
type AppOptionCreator func() []AppOption

func ServerConnector(s *Server) AppOption {
	return func(a *App) {
		a.Srv = s

		a.Log = s.Log

		a.AccountMigration = s.AccountMigration
		a.Cluster = s.Cluster
		a.Compliance = s.Compliance
		a.DataRetention = s.DataRetention
		a.Elasticsearch = s.Elasticsearch
		a.Ldap = s.Ldap
		a.MessageExport = s.MessageExport
		a.Metrics = s.Metrics
		a.Saml = s.Saml

		a.HTTPService = s.HTTPService
		a.ImageProxy = s.ImageProxy
		a.Timezones = s.timezones
	}
}
