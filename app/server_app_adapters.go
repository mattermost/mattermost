// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"net/url"
	"path"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/mailservice"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/store/sqlstore"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/pkg/errors"
)

// This is a bridge between the old and new initalization for the context refactor.
// It calls app layer initalization code that then turns around and acts on the server.
// Don't add anything new here, new initilization should be done in the server and
// performed in the NewServer function.
func (s *Server) RunOldAppInitalization() error {
	a := s.FakeApp()

	a.CreatePushNotificationsHub()
	a.StartPushNotificationsHubWorkers()

	if err := utils.InitTranslations(a.Config().LocalizationSettings); err != nil {
		return errors.Wrapf(err, "unable to load Mattermost translation files")
	}

	a.Srv.configListenerId = a.AddConfigListener(func(_, _ *model.Config) {
		a.configOrLicenseListener()

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CONFIG_CHANGED, "", "", "", nil)

		message.Add("config", a.ClientConfigWithComputed())
		a.Srv.Go(func() {
			a.Publish(message)
		})
	})
	a.Srv.licenseListenerId = a.AddLicenseListener(func() {
		a.configOrLicenseListener()

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_LICENSE_CHANGED, "", "", "", nil)
		message.Add("license", a.GetSanitizedClientLicense())
		a.Srv.Go(func() {
			a.Publish(message)
		})

	})

	if err := a.SetupInviteEmailRateLimiting(); err != nil {
		return err
	}

	mlog.Info("Server is initializing...")

	s.initEnterprise()

	if a.Srv.newStore == nil {
		a.Srv.newStore = func() store.Store {
			return store.NewLayeredStore(sqlstore.NewSqlSupplier(a.Config().SqlSettings, a.Metrics), a.Metrics, a.Cluster)
		}
	}

	if htmlTemplateWatcher, err := utils.NewHTMLTemplateWatcher("templates"); err != nil {
		mlog.Error(fmt.Sprintf("Failed to parse server templates %v", err))
	} else {
		a.Srv.htmlTemplateWatcher = htmlTemplateWatcher
	}

	a.Srv.Store = a.Srv.newStore()

	if err := a.ensureAsymmetricSigningKey(); err != nil {
		return errors.Wrapf(err, "unable to ensure asymmetric signing key")
	}

	if err := a.ensureInstallationDate(); err != nil {
		return errors.Wrapf(err, "unable to ensure installation date")
	}

	a.EnsureDiagnosticId()
	a.regenerateClientConfig()

	a.Srv.clusterLeaderListenerId = a.Srv.AddClusterLeaderChangedListener(func() {
		mlog.Info("Cluster leader changed. Determining if job schedulers should be running:", mlog.Bool("isLeader", a.IsLeader()))
		if a.Srv.Jobs != nil {
			a.Srv.Jobs.Schedulers.HandleClusterLeaderChange(a.IsLeader())
		}
	})

	subpath, err := utils.GetSubpathFromConfig(a.Config())
	if err != nil {
		return errors.Wrap(err, "failed to parse SiteURL subpath")
	}
	a.Srv.Router = a.Srv.RootRouter.PathPrefix(subpath).Subrouter()
	a.Srv.Router.HandleFunc("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}", a.ServePluginRequest)
	a.Srv.Router.HandleFunc("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}/{anything:.*}", a.ServePluginRequest)

	// If configured with a subpath, redirect 404s at the root back into the subpath.
	if subpath != "/" {
		a.Srv.RootRouter.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.URL.Path = path.Join(subpath, r.URL.Path)
			http.Redirect(w, r, r.URL.String(), http.StatusFound)
		})
	}
	a.Srv.Router.NotFoundHandler = http.HandlerFunc(a.Handle404)

	a.Srv.WebSocketRouter = &WebSocketRouter{
		app:      a,
		handlers: make(map[string]webSocketHandler),
	}

	mailservice.TestConnection(a.Config())

	if _, err := url.ParseRequestURI(*a.Config().ServiceSettings.SiteURL); err != nil {
		mlog.Error("SiteURL must be set. Some features will operate incorrectly if the SiteURL is not set. See documentation for details: http://about.mattermost.com/default-site-url")
	}

	backend, appErr := a.FileBackend()
	if appErr == nil {
		appErr = backend.TestConnection()
	}
	if appErr != nil {
		mlog.Error("Problem with file storage settings: " + appErr.Error())
	}

	if model.BuildEnterpriseReady == "true" {
		a.LoadLicense()
	}

	a.DoAdvancedPermissionsMigration()
	a.DoEmojisPermissionsMigration()

	a.InitPostMetadata()

	a.InitPlugins(*a.Config().PluginSettings.Directory, *a.Config().PluginSettings.ClientDirectory)
	a.AddConfigListener(func(prevCfg, cfg *model.Config) {
		if *cfg.PluginSettings.Enable {
			a.InitPlugins(*cfg.PluginSettings.Directory, *a.Config().PluginSettings.ClientDirectory)
		} else {
			a.ShutDownPlugins()
		}
	})

	return nil
}

func (s *Server) RunOldAppShutdown() {
	a := s.FakeApp()
	a.HubStop()
	a.StopPushNotificationsHubWorkers()
	a.ShutDownPlugins()
	a.RemoveLicenseListener(s.licenseListenerId)
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
