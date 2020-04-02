// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"net/url"
	"path"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/mailservice"
	"github.com/mattermost/mattermost-server/v5/store"
	"github.com/mattermost/mattermost-server/v5/store/localcachelayer"
	"github.com/mattermost/mattermost-server/v5/store/searchlayer"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/pkg/errors"
)

// This is a bridge between the old and new initialization for the context refactor.
// It calls app layer initialization code that then turns around and acts on the server.
// Don't add anything new here, new initialization should be done in the server and
// performed in the NewServer function.
func (s *Server) RunOldAppInitialization() error {
	s.FakeApp().createPushNotificationsHub()

	if err := utils.InitTranslations(s.Config().LocalizationSettings); err != nil {
		return errors.Wrapf(err, "unable to load Mattermost translation files")
	}

	s.configListenerId = s.AddConfigListener(func(_, _ *model.Config) {
		s.FakeApp().configOrLicenseListener()

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CONFIG_CHANGED, "", "", "", nil)

		message.Add("config", s.FakeApp().ClientConfigWithComputed())
		s.Go(func() {
			s.FakeApp().Publish(message)
		})
	})
	s.licenseListenerId = s.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		s.FakeApp().configOrLicenseListener()

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_LICENSE_CHANGED, "", "", "", nil)
		message.Add("license", s.FakeApp().GetSanitizedClientLicense())
		s.Go(func() {
			s.FakeApp().Publish(message)
		})

	})

	if err := s.FakeApp().SetupInviteEmailRateLimiting(); err != nil {
		return err
	}

	mlog.Info("Server is initializing...")

	s.initEnterprise()

	if s.newStore == nil {
		s.newStore = func() store.Store {
			return store.NewTimerLayer(
				searchlayer.NewSearchLayer(
					localcachelayer.NewLocalCacheLayer(
						sqlstore.NewSqlSupplier(s.Config().SqlSettings, s.Metrics),
						s.Metrics,
						s.Cluster,
						s.CacheProvider,
					),
					s.SearchEngine,
				),
				s.Metrics,
			)
		}
	}

	if htmlTemplateWatcher, err := utils.NewHTMLTemplateWatcher("templates"); err != nil {
		mlog.Error("Failed to parse server templates", mlog.Err(err))
	} else {
		s.htmlTemplateWatcher = htmlTemplateWatcher
	}

	s.Store = s.newStore()
	s.FakeApp().StartPushNotificationsHubWorkers()

	if err := s.FakeApp().ensureAsymmetricSigningKey(); err != nil {
		return errors.Wrapf(err, "unable to ensure asymmetric signing key")
	}

	if err := s.FakeApp().ensurePostActionCookieSecret(); err != nil {
		return errors.Wrapf(err, "unable to ensure PostAction cookie secret")
	}

	if err := s.FakeApp().ensureInstallationDate(); err != nil {
		return errors.Wrapf(err, "unable to ensure installation date")
	}

	s.ensureDiagnosticId()
	s.FakeApp().regenerateClientConfig()

	s.clusterLeaderListenerId = s.AddClusterLeaderChangedListener(func() {
		mlog.Info("Cluster leader changed. Determining if job schedulers should be running:", mlog.Bool("isLeader", s.FakeApp().IsLeader()))
		if s.Jobs != nil {
			s.Jobs.Schedulers.HandleClusterLeaderChange(s.FakeApp().IsLeader())
		}
	})

	subpath, err := utils.GetSubpathFromConfig(s.Config())
	if err != nil {
		return errors.Wrap(err, "failed to parse SiteURL subpath")
	}
	s.Router = s.RootRouter.PathPrefix(subpath).Subrouter()
	pluginsRoute := s.Router.PathPrefix("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}").Subrouter()
	pluginsRoute.HandleFunc("", s.FakeApp().ServePluginRequest)
	pluginsRoute.HandleFunc("/public/{public_file:.*}", s.FakeApp().ServePluginPublicRequest)
	pluginsRoute.HandleFunc("/{anything:.*}", s.FakeApp().ServePluginRequest)

	// If configured with a subpath, redirect 404s at the root back into the subpath.
	if subpath != "/" {
		s.RootRouter.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.URL.Path = path.Join(subpath, r.URL.Path)
			http.Redirect(w, r, r.URL.String(), http.StatusFound)
		})
	}
	s.Router.NotFoundHandler = http.HandlerFunc(s.FakeApp().Handle404)

	s.WebSocketRouter = &WebSocketRouter{
		app:      s.FakeApp(),
		handlers: make(map[string]webSocketHandler),
	}

	if err := mailservice.TestConnection(s.Config()); err != nil {
		mlog.Error("Mail server connection test is failed: " + err.Message)
	}

	if _, err := url.ParseRequestURI(*s.Config().ServiceSettings.SiteURL); err != nil {
		mlog.Error("SiteURL must be set. Some features will operate incorrectly if the SiteURL is not set. See documentation for details: http://about.mattermost.com/default-site-url")
	}

	backend, appErr := s.FileBackend()
	if appErr == nil {
		appErr = backend.TestConnection()
	}
	if appErr != nil {
		mlog.Error("Problem with file storage settings", mlog.Err(appErr))
	}

	if model.BuildEnterpriseReady == "true" {
		s.FakeApp().LoadLicense()
	}

	s.FakeApp().DoAppMigrations()

	s.FakeApp().InitPostMetadata()

	s.FakeApp().InitPlugins(*s.Config().PluginSettings.Directory, *s.Config().PluginSettings.ClientDirectory)
	s.FakeApp().AddConfigListener(func(prevCfg, cfg *model.Config) {
		if *cfg.PluginSettings.Enable {
			s.FakeApp().InitPlugins(*cfg.PluginSettings.Directory, *s.Config().PluginSettings.ClientDirectory)
		} else {
			s.FakeApp().ShutDownPlugins()
		}
	})

	return nil
}

func (s *Server) RunOldAppShutdown() {
	s.FakeApp().HubStop()
	s.FakeApp().StopPushNotificationsHubWorkers()
	s.FakeApp().ShutDownPlugins()
	s.FakeApp().RemoveLicenseListener(s.licenseListenerId)
	s.RemoveClusterLeaderChangedListener(s.clusterLeaderListenerId)
}

// A temporary bridge to deal with cases where the code is so tighly coupled that
// this is easier as a temporary solution
func (s *Server) FakeApp() *App {
	a := New(
		ServerConnector(s),
	)
	return a
}
