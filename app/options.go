// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/config"
	"github.com/mattermost/mattermost-server/store"
)

type Option func(s *Server) error

// By default, the app will use the store specified by the configuration. This allows you to
// construct an app with a different store.
//
// The override parameter must be either a store.Store or func(App) store.Store.
func StoreOverride(override interface{}) Option {
	return func(s *Server) error {
		switch o := override.(type) {
		case store.Store:
			s.newStore = func() store.Store {
				return o
			}
			return nil

		case func(*Server) store.Store:
			s.newStore = func() store.Store {
				return o(s)
			}
			return nil

		default:
			return errors.New("invalid StoreOverride")
		}
	}
}

func ConfigFile(file string, watch bool) Option {
	return func(s *Server) error {
		configStore, _, err := config.NewFileStore(file, watch)
		if err != nil {
			return errors.Wrap(err, "failed to apply ConfigFile option")
		}

		s.configStore = configStore
		return nil
	}
}

func ConfigStore(configStore config.Store) Option {
	return func(s *Server) error {
		s.configStore = configStore

		return nil
	}
}

func RunJobs(s *Server) error {
	s.runjobs = true

	return nil
}

func JoinCluster(s *Server) error {
	s.joinCluster = true

	return nil
}

func StartMetrics(s *Server) error {
	s.startMetrics = true

	return nil
}

func StartElasticsearch(s *Server) error {
	s.startElasticsearch = true

	return nil
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
