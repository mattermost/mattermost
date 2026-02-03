// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

type Option func(s *Server) error

// By default, the app will use the store specified by the configuration. This allows you to
// construct an app with a different store.
//
// The override parameter must be either a store.Store or func(App) store.Store().
func StoreOverride(override any) Option {
	return func(s *Server) error {
		s.platformOptions = append(s.platformOptions, platform.StoreOverride(override))
		return nil
	}
}

func StoreOverrideWithCache(override store.Store) Option {
	return func(s *Server) error {
		s.platformOptions = append(s.platformOptions, platform.StoreOverrideWithCache(override))
		return nil
	}
}

func StoreOption(option sqlstore.Option) Option {
	return func(s *Server) error {
		s.platformOptions = append(s.platformOptions, platform.StoreOption(option))
		return nil
	}
}

// Config applies the given config dsn, whether a path to config.json
// or a database connection string. It receives as well a set of
// custom defaults that will be applied for any unset property of the
// config loaded from the dsn on top of the normal defaults
func Config(dsn string, readOnly bool, configDefaults *model.Config) Option {
	return func(s *Server) error {
		s.platformOptions = append(s.platformOptions, platform.Config(dsn, readOnly, configDefaults))
		return nil
	}
}

// ConfigStore applies the given config store, typically to replace the traditional sources with a memory store for testing.
func ConfigStore(configStore *config.Store) Option {
	return func(s *Server) error {
		s.platformOptions = append(s.platformOptions, platform.ConfigStore(configStore))
		return nil
	}
}

func SetFileStore(filestore filestore.FileBackend) Option {
	return func(s *Server) error {
		s.platformOptions = append(s.platformOptions, platform.SetFileStore(filestore))
		return nil
	}
}

func ForceEnableRedis() Option {
	return func(s *Server) error {
		s.platformOptions = append(s.platformOptions, platform.ForceEnableRedis())
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
	s.platformOptions = append(s.platformOptions, platform.StartMetrics())
	return nil
}

func WithLicense(license *model.License) Option {
	return func(s *Server) error {
		s.platformOptions = append(s.platformOptions, func(p *platform.PlatformService) error {
			p.SetLicense(license)
			return nil
		})
		return nil
	}
}

// SetLogger requires platform service to be initialized before calling.
// If not, logger should be set after platform service are initialized.
func SetLogger(logger *mlog.Logger) Option {
	return func(s *Server) error {
		s.platformOptions = append(s.platformOptions, platform.SetLogger(logger))
		return nil
	}
}

func SkipPostInitialization() Option {
	return func(s *Server) error {
		s.skipPostInit = true

		return nil
	}
}

type (
	AppOption        func(a *App)
	AppOptionCreator func() []AppOption
)

func ServerConnector(ch *Channels) AppOption {
	return func(a *App) {
		a.ch = ch
	}
}

func SetCluster(impl einterfaces.ClusterInterface) Option {
	return func(s *Server) error {
		s.platformOptions = append(s.platformOptions, platform.SetCluster(impl))
		return nil
	}
}
