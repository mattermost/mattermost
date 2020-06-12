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
	s.createPushNotificationsHub()

	if err := utils.InitTranslations(s.Config().LocalizationSettings); err != nil {
		return errors.Wrapf(err, "unable to load Mattermost translation files")
	}

	s.configListenerId = s.AddConfigListener(func(_, _ *model.Config) {
		s.configOrLicenseListener()

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CONFIG_CHANGED, "", "", "", nil)

		message.Add("config", s.ClientConfigWithComputed())
		s.Go(func() {
			s.Publish(message)
		})
	})
	s.licenseListenerId = s.AddLicenseListener(func(oldLicense, newLicense *model.License) {
		s.configOrLicenseListener()

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_LICENSE_CHANGED, "", "", "", nil)
		message.Add("license", s.GetSanitizedClientLicense())
		s.Go(func() {
			s.Publish(message)
		})

	})

	if err := s.setupInviteEmailRateLimiting(); err != nil {
		return err
	}

	mlog.Info("Server is initializing...")

	s.initEnterprise()

	if s.newStore == nil {
		s.newStore = func() store.Store {
			s.sqlStore = sqlstore.NewSqlSupplier(s.Config().SqlSettings, s.Metrics)
			searchStore := searchlayer.NewSearchLayer(
				localcachelayer.NewLocalCacheLayer(
					s.sqlStore,
					s.Metrics,
					s.Cluster,
					s.CacheProvider,
				),
				s.SearchEngine,
				s.Config(),
			)

			s.AddConfigListener(func(prevCfg, cfg *model.Config) {
				searchStore.UpdateConfig(cfg)
			})

			s.sqlStore.UpdateLicense(s.License())
			s.AddLicenseListener(func(oldLicense, newLicense *model.License) {
				s.sqlStore.UpdateLicense(newLicense)
			})

			return store.NewTimerLayer(
				searchStore,
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

	if model.BuildEnterpriseReady == "true" {
		s.LoadLicense()
	}

	s.initJobs()

	if s.joinCluster && s.Cluster != nil {
		s.Cluster.StartInterNodeCommunication()
	}

	if err := s.ensureAsymmetricSigningKey(); err != nil {
		return errors.Wrapf(err, "unable to ensure asymmetric signing key")
	}

	if err := s.ensurePostActionCookieSecret(); err != nil {
		return errors.Wrapf(err, "unable to ensure PostAction cookie secret")
	}

	if err := s.ensureInstallationDate(); err != nil {
		return errors.Wrapf(err, "unable to ensure installation date")
	}

	if err := s.ensureFirstServerRunTimestamp(); err != nil {
		return errors.Wrapf(err, "unable to ensure first run timestamp")
	}

	s.ensureDiagnosticId()
	s.regenerateClientConfig()

	s.clusterLeaderListenerId = s.AddClusterLeaderChangedListener(func() {
		mlog.Info("Cluster leader changed. Determining if job schedulers should be running:", mlog.Bool("isLeader", s.IsLeader()))
		if s.Jobs != nil && s.Jobs.Schedulers != nil {
			s.Jobs.Schedulers.HandleClusterLeaderChange(s.IsLeader())
		}
	})

	subpath, err := utils.GetSubpathFromConfig(s.Config())
	if err != nil {
		return errors.Wrap(err, "failed to parse SiteURL subpath")
	}
	s.Router = s.RootRouter.PathPrefix(subpath).Subrouter()

	// If configured with a subpath, redirect 404s at the root back into the subpath.
	if subpath != "/" {
		s.RootRouter.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.URL.Path = path.Join(subpath, r.URL.Path)
			http.Redirect(w, r, r.URL.String(), http.StatusFound)
		})
	}

	s.WebSocketRouter = &WebSocketRouter{
		server:   s,
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

	return nil
}
