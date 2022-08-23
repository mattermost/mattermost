// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/app/platform"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/filestore"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

type Option func(s *Server) error

// By default, the app will use the store specified by the configuration. This allows you to
// construct an app with a different store.
//
// The override parameter must be either a store.Store or func(App) store.Store().
func StoreOverride(override any) Option {
	return func(s *Server) error {
		switch o := override.(type) {
		case store.Store:
			s.newStore = func() (store.Store, error) {
				return o, nil
			}
			return nil

		case func(*Server) store.Store:
			s.newStore = func() (store.Store, error) {
				return o(s), nil
			}
			return nil

		default:
			return errors.New("invalid StoreOverride")
		}
	}
}

// Config applies the given config dsn, whether a path to config.json
// or a database connection string. It receives as well a set of
// custom defaults that will be applied for any unset property of the
// config loaded from the dsn on top of the normal defaults
func Config(dsn string, readOnly bool, configDefaults *model.Config) Option {
	return func(s *Server) error {
		configStore, err := config.NewStoreFromDSN(dsn, readOnly, configDefaults, true)
		if err != nil {
			return errors.Wrap(err, "failed to apply Config option")
		}

		platformCfg := platform.ServiceConfig{
			ConfigStore:  configStore,
			StartMetrics: s.startMetrics,
			Cluster:      s.Cluster,
		}
		if metricsInterface != nil {
			platformCfg.Metrics = metricsInterface(s, *configStore.Get().SqlSettings.DriverName, *configStore.Get().SqlSettings.DataSource)
		}

		ps, sErr := platform.New(platformCfg)
		if sErr != nil {
			return errors.Wrap(sErr, "failed to initialize platform")
		}
		s.platform = ps

		return nil
	}
}

// ConfigStore applies the given config store, typically to replace the traditional sources with a memory store for testing.
func ConfigStore(configStore *config.Store) Option {
	return func(s *Server) error {
		platformCfg := platform.ServiceConfig{
			ConfigStore:  configStore,
			StartMetrics: s.startMetrics,
			Cluster:      s.Cluster,
		}
		if metricsInterface != nil {
			platformCfg.Metrics = metricsInterface(s, *configStore.Get().SqlSettings.DriverName, *configStore.Get().SqlSettings.DataSource)
		}

		ps, sErr := platform.New(platformCfg)
		if sErr != nil {
			return errors.Wrap(sErr, "failed to initialize platform")
		}
		s.platform = ps

		return nil
	}
}

func SetFileStore(filestore filestore.FileBackend) Option {
	return func(s *Server) error {
		s.filestore = filestore
		return nil
	}
}

func RunEssentialJobs(s *Server) error {
	s.runEssentialJobs = true

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

func StartSearchEngine(s *Server) error {
	s.startSearchEngine = true

	return nil
}

// SetLogger requires platform service to be initialized before calling.
// If not, logger should be set after platform service are initialized.
func SetLogger(logger *mlog.Logger) Option {
	return func(s *Server) error {
		if s.platform == nil {
			return errors.New("platform service is not initialized")
		}

		s.platform.SetLogger(logger)
		return nil
	}
}

func SkipPostInitialization() Option {
	return func(s *Server) error {
		s.skipPostInit = true

		return nil
	}
}

type AppOption func(a *App)
type AppOptionCreator func() []AppOption

func ServerConnector(ch *Channels) AppOption {
	return func(a *App) {
		a.ch = ch
	}
}

func setCluster(cluster einterfaces.ClusterInterface) Option {
	return func(s *Server) error {
		s.Cluster = cluster
		return nil
	}
}
