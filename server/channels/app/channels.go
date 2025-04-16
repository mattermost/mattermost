// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"os/signal"
	"runtime"
	"strings"
	"sync"
	"syscall"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/imaging"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/platform/services/imageproxy"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

type configService interface {
	Config() *model.Config
	AddConfigListener(listener func(*model.Config, *model.Config)) string
	RemoveConfigListener(id string)
	UpdateConfig(f func(*model.Config))
	SaveConfig(newCfg *model.Config, sendConfigChangeClusterMessage bool) (*model.Config, *model.Config, *model.AppError)
}

// Channels contains all channels related state.
type Channels struct {
	srv             *Server
	cfgSvc          configService
	filestore       filestore.FileBackend
	exportFilestore filestore.FileBackend

	postActionCookieSecret []byte

	pluginCommandsLock            sync.RWMutex
	pluginCommands                []*PluginCommand
	pluginsLock                   sync.RWMutex
	pluginsEnvironment            *plugin.Environment
	pluginConfigListenerID        string
	pluginClusterLeaderListenerID string

	imageProxy *imageproxy.ImageProxy

	// cached counts that are used during notice condition validation
	cachedPostCount   int64
	cachedUserCount   int64
	cachedDBMSVersion string
	// previously fetched notices
	cachedNotices model.ProductNotices

	AccountMigration einterfaces.AccountMigrationInterface
	Compliance       einterfaces.ComplianceInterface
	DataRetention    einterfaces.DataRetentionInterface
	MessageExport    einterfaces.MessageExportInterface
	Saml             einterfaces.SamlInterface
	Notification     einterfaces.NotificationInterface
	Ldap             einterfaces.LdapInterface
	AccessControl    einterfaces.AccessControlServiceInterface

	// These are used to prevent concurrent upload requests
	// for a given upload session which could cause inconsistencies
	// and data corruption.
	uploadLockMapMut sync.Mutex
	uploadLockMap    map[string]bool

	imgDecoder *imaging.Decoder
	imgEncoder *imaging.Encoder

	dndTaskMut sync.Mutex
	dndTask    *model.ScheduledTask

	postReminderMut  sync.Mutex
	postReminderTask *model.ScheduledTask

	interruptQuitChan     chan struct{}
	scheduledPostMut      sync.Mutex
	scheduledPostTask     *model.ScheduledTask
	emailLoginAttemptsMut sync.Mutex
	ldapLoginAttemptsMut  sync.Mutex
}

func NewChannels(s *Server) (*Channels, error) {
	ch := &Channels{
		srv:               s,
		imageProxy:        imageproxy.MakeImageProxy(s.platform, s.httpService, s.Log()),
		uploadLockMap:     map[string]bool{},
		filestore:         s.FileBackend(),
		exportFilestore:   s.ExportFileBackend(),
		cfgSvc:            s.Platform(),
		interruptQuitChan: make(chan struct{}),
	}

	// We are passing a partially filled Channels struct so that the enterprise
	// methods can have access to app methods.
	// Otherwise, passing server would mean it has to call s.Channels(),
	// which would be nil at this point.
	if complianceInterface != nil {
		ch.Compliance = complianceInterface(New(ServerConnector(ch)))
	}
	if messageExportInterface != nil {
		ch.MessageExport = messageExportInterface(New(ServerConnector(ch)))
	}
	if dataRetentionInterface != nil {
		ch.DataRetention = dataRetentionInterface(New(ServerConnector(ch)))
	}
	if accountMigrationInterface != nil {
		ch.AccountMigration = accountMigrationInterface(New(ServerConnector(ch)))
	}
	if ldapInterface != nil {
		ch.Ldap = ldapInterface(New(ServerConnector(ch)))
	}
	if notificationInterface != nil {
		ch.Notification = notificationInterface(New(ServerConnector(ch)))
	}
	if samlInterface != nil {
		ch.Saml = samlInterface(New(ServerConnector(ch)))
		if err := ch.Saml.ConfigureSP(request.EmptyContext(s.Log())); err != nil {
			s.Log().Error("An error occurred while configuring SAML Service Provider", mlog.Err(err))
		}

		ch.AddConfigListener(func(_, _ *model.Config) {
			if err := ch.Saml.ConfigureSP(request.EmptyContext(s.Log())); err != nil {
				s.Log().Error("An error occurred while configuring SAML Service Provider", mlog.Err(err))
			}
		})
	}
	if accessControlServiceInterface != nil {
		app := New(ServerConnector(ch))
		ch.AccessControl = accessControlServiceInterface(app)

		appErr := ch.AccessControl.Init(request.EmptyContext(s.Log()))
		if appErr != nil {
			s.Log().Error("An error occurred while initializing Access Control", mlog.Err(appErr))
		}

		app.AddLicenseListener(func(newCfg, old *model.License) {
			if ch.AccessControl != nil {
				if appErr := ch.AccessControl.Init(request.EmptyContext(s.Log())); appErr != nil {
					s.Log().Error("An error occurred while initializing Access Control", mlog.Err(appErr))
				}
			}
		})
	}

	var imgErr error
	decoderConcurrency := int(*ch.cfgSvc.Config().FileSettings.MaxImageDecoderConcurrency)
	if decoderConcurrency == -1 {
		decoderConcurrency = runtime.NumCPU()
	}
	ch.imgDecoder, imgErr = imaging.NewDecoder(imaging.DecoderOptions{
		ConcurrencyLevel: decoderConcurrency,
	})
	if imgErr != nil {
		return nil, errors.Wrap(imgErr, "failed to create image decoder")
	}
	ch.imgEncoder, imgErr = imaging.NewEncoder(imaging.EncoderOptions{
		ConcurrencyLevel: runtime.NumCPU(),
	})
	if imgErr != nil {
		return nil, errors.Wrap(imgErr, "failed to create image encoder")
	}

	// Setup routes.
	pluginsRoute := ch.srv.Router.PathPrefix("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}").Subrouter()
	pluginsRoute.HandleFunc("", ch.ServePluginRequest)
	pluginsRoute.HandleFunc("/public/{public_file:.*}", ch.ServePluginPublicRequest)
	pluginsRoute.HandleFunc("/{anything:.*}", ch.ServePluginRequest)

	return ch, nil
}

func (ch *Channels) Start() error {
	// Start plugins
	ctx := request.EmptyContext(ch.srv.Log())
	ch.initPlugins(ctx, *ch.cfgSvc.Config().PluginSettings.Directory, *ch.cfgSvc.Config().PluginSettings.ClientDirectory)

	interruptChan := make(chan os.Signal, 1)
	signal.Notify(interruptChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		select {
		case <-interruptChan:
			if err := ch.Stop(); err != nil {
				ch.srv.Log().Warn("Error stopping channels", mlog.Err(err))
			}
			os.Exit(1)
		case <-ch.interruptQuitChan:
			return
		}
	}()

	ch.AddConfigListener(func(prevCfg, cfg *model.Config) {
		// We compute the difference between configs
		// to ensure we don't re-init plugins unnecessarily.
		diffs, err := config.Diff(prevCfg, cfg)
		if err != nil {
			ch.srv.Log().Warn("Error in comparing configs", mlog.Err(err))
			return
		}

		hasDiff := false
		// TODO: This could be a method on ConfigDiffs itself
		for _, diff := range diffs {
			if strings.HasPrefix(diff.Path, "PluginSettings.") {
				hasDiff = true
				break
			}
		}

		// Do only if some plugin related settings has changed.
		if hasDiff {
			if *cfg.PluginSettings.Enable {
				ch.initPlugins(ctx, *cfg.PluginSettings.Directory, *ch.cfgSvc.Config().PluginSettings.ClientDirectory)
			} else {
				ch.ShutDownPlugins()
			}
		}
	})

	// TODO: This should be moved to the platform service.
	if err := ch.srv.platform.EnsureAsymmetricSigningKey(); err != nil {
		return errors.Wrapf(err, "unable to ensure asymmetric signing key")
	}

	if err := ch.ensurePostActionCookieSecret(); err != nil {
		return errors.Wrapf(err, "unable to ensure PostAction cookie secret")
	}

	return nil
}

func (ch *Channels) Stop() error {
	ch.ShutDownPlugins()

	ch.dndTaskMut.Lock()
	if ch.dndTask != nil {
		ch.dndTask.Cancel()
	}
	ch.dndTaskMut.Unlock()

	close(ch.interruptQuitChan)

	return nil
}

func (ch *Channels) AddConfigListener(listener func(*model.Config, *model.Config)) string {
	return ch.cfgSvc.AddConfigListener(listener)
}

func (ch *Channels) RemoveConfigListener(id string) {
	ch.cfgSvc.RemoveConfigListener(id)
}

func (ch *Channels) RunMultiHook(hookRunnerFunc func(hooks plugin.Hooks, manifest *model.Manifest) bool, hookId int) {
	if env := ch.GetPluginsEnvironment(); env != nil {
		env.RunMultiPluginHook(hookRunnerFunc, hookId)
	}
}

func (ch *Channels) HooksForPlugin(id string) (plugin.Hooks, error) {
	env := ch.GetPluginsEnvironment()
	if env == nil {
		return nil, errors.New("plugins are not initialized")
	}

	hooks, err := env.HooksForPlugin(id)
	if err != nil {
		return nil, err
	}

	return hooks, nil
}
