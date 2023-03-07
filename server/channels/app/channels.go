// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"runtime"
	"strings"
	"sync"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/server/v8/channels/app/imaging"
	"github.com/mattermost/mattermost-server/server/v8/channels/app/request"
	"github.com/mattermost/mattermost-server/server/v8/channels/einterfaces"
	"github.com/mattermost/mattermost-server/server/v8/channels/product"
	"github.com/mattermost/mattermost-server/server/v8/config"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/services/imageproxy"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/filestore"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/plugin"
)

const ServerKey product.ServiceKey = "server"

// licenseSvc is added to act as a starting point for future integrated products.
// It has the same signature and functionality with the license related APIs of the plugin-api.
type licenseSvc interface {
	GetLicense() *model.License
	RequestTrialLicense(requesterID string, users int, termsAccepted bool, receiveEmailsAccepted bool) *model.AppError
}

// Channels contains all channels related state.
type Channels struct {
	srv        *Server
	cfgSvc     product.ConfigService
	filestore  filestore.FileBackend
	licenseSvc licenseSvc
	routerSvc  *routerService

	postActionCookieSecret []byte

	pluginCommandsLock     sync.RWMutex
	pluginCommands         []*PluginCommand
	pluginsLock            sync.RWMutex
	pluginsEnvironment     *plugin.Environment
	pluginConfigListenerID string

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

	// collectionTypes maps from collection types to the registering plugin id
	collectionTypes map[string]string
	// topicTypes maps from topic types to collection types
	topicTypes                 map[string]string
	collectionAndTopicTypesMut sync.Mutex
}

func init() {
	product.RegisterProduct("channels", product.Manifest{
		Initializer: func(services map[product.ServiceKey]any) (product.Product, error) {
			return NewChannels(services)
		},
		Dependencies: map[product.ServiceKey]struct{}{
			ServerKey:            {},
			product.ConfigKey:    {},
			product.LicenseKey:   {},
			product.FilestoreKey: {},
		},
	})
}

func NewChannels(services map[product.ServiceKey]any) (*Channels, error) {
	s, ok := services[ServerKey].(*Server)
	if !ok {
		return nil, errors.New("server not passed")
	}
	ch := &Channels{
		srv:             s,
		imageProxy:      imageproxy.MakeImageProxy(s.platform, s.httpService, s.Log()),
		uploadLockMap:   map[string]bool{},
		collectionTypes: map[string]string{},
		topicTypes:      map[string]string{},
	}

	// To get another service:
	// 1. Prepare the service interface
	// 2. Add the field to *Channels
	// 3. Add the service key to the slice.
	// 4. Add a new case in the switch statement.
	requiredServices := []product.ServiceKey{
		product.ConfigKey,
		product.LicenseKey,
		product.FilestoreKey,
	}
	for _, svcKey := range requiredServices {
		svc, ok := services[svcKey]
		if !ok {
			return nil, fmt.Errorf("Service %s not passed", svcKey)
		}
		switch svcKey {
		// Keep adding more services here
		case product.ConfigKey:
			cfgSvc, ok := svc.(product.ConfigService)
			if !ok {
				return nil, errors.New("Config service did not satisfy ConfigSvc interface")
			}
			ch.cfgSvc = cfgSvc
		case product.FilestoreKey:
			filestore, ok := svc.(filestore.FileBackend)
			if !ok {
				return nil, errors.New("Filestore service did not satisfy FileBackend interface")
			}
			ch.filestore = filestore
		case product.LicenseKey:
			svc, ok := svc.(licenseSvc)
			if !ok {
				return nil, errors.New("License service did not satisfy licenseSvc interface")
			}
			ch.licenseSvc = svc
		}
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
	if samlInterfaceNew != nil {
		ch.Saml = samlInterfaceNew(New(ServerConnector(ch)))
		if err := ch.Saml.ConfigureSP(); err != nil {
			s.Log().Error("An error occurred while configuring SAML Service Provider", mlog.Err(err))
		}

		ch.AddConfigListener(func(_, _ *model.Config) {
			if err := ch.Saml.ConfigureSP(); err != nil {
				s.Log().Error("An error occurred while configuring SAML Service Provider", mlog.Err(err))
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

	ch.routerSvc = newRouterService()
	services[product.RouterKey] = ch.routerSvc

	// Setup routes.
	pluginsRoute := ch.srv.Router.PathPrefix("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}").Subrouter()
	pluginsRoute.HandleFunc("", ch.ServePluginRequest)
	pluginsRoute.HandleFunc("/public/{public_file:.*}", ch.ServePluginPublicRequest)
	pluginsRoute.HandleFunc("/{anything:.*}", ch.ServePluginRequest)

	services[product.ChannelKey] = &channelsWrapper{
		app: &App{ch: ch},
	}

	services[product.PostKey] = &postServiceWrapper{
		app: &App{ch: ch},
	}

	services[product.PermissionsKey] = &permissionsServiceWrapper{
		app: &App{ch: ch},
	}

	services[product.TeamKey] = &teamServiceWrapper{
		app: &App{ch: ch},
	}

	services[product.BotKey] = &botServiceWrapper{
		app: &App{ch: ch},
	}

	services[product.HooksKey] = &hooksService{
		ch: ch,
	}

	services[product.UserKey] = &App{ch: ch}

	services[product.PreferencesKey] = &preferencesServiceWrapper{
		app: &App{ch: ch},
	}

	services[product.CommandKey] = &App{ch: ch}

	services[product.ThreadsKey] = &App{ch: ch}

	return ch, nil
}

func (ch *Channels) Start() error {
	// Start plugins
	ctx := request.EmptyContext(ch.srv.Log())
	ch.initPlugins(ctx, *ch.cfgSvc.Config().PluginSettings.Directory, *ch.cfgSvc.Config().PluginSettings.ClientDirectory)

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

	// This needs to be done after initPlugins has completed,
	// because we want the full plugin processing to be complete before disabling it.
	ch.disableBoardsIfNeeded()
	ch.srv.AddClusterLeaderChangedListener(ch.disableBoardsIfNeeded)

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

	return nil
}

func (ch *Channels) AddConfigListener(listener func(*model.Config, *model.Config)) string {
	return ch.cfgSvc.AddConfigListener(listener)
}

func (ch *Channels) RemoveConfigListener(id string) {
	ch.cfgSvc.RemoveConfigListener(id)
}

func (ch *Channels) License() *model.License {
	return ch.licenseSvc.GetLicense()
}

func (ch *Channels) RequestTrialLicense(requesterID string, users int, termsAccepted bool, receiveEmailsAccepted bool) *model.AppError {
	return ch.licenseSvc.RequestTrialLicense(requesterID, users, termsAccepted,
		receiveEmailsAccepted)
}

func (a *App) HooksManager() *product.HooksManager {
	return a.Srv().hooksManager
}

// Ensure hooksService implements `product.HooksService`
var _ product.HooksService = (*hooksService)(nil)

type hooksService struct {
	ch *Channels
}

func (s *hooksService) RegisterHooks(productID string, hooks any) error {
	return s.ch.srv.hooksManager.AddProduct(productID, hooks)
}

func (ch *Channels) RunMultiHook(hookRunnerFunc func(hooks plugin.Hooks) bool, hookId int) {
	if env := ch.GetPluginsEnvironment(); env != nil {
		env.RunMultiPluginHook(hookRunnerFunc, hookId)
	}

	// run hook for the products
	ch.srv.hooksManager.RunMultiHook(hookRunnerFunc, hookId)
}

func (ch *Channels) HooksForPluginOrProduct(id string) (plugin.Hooks, error) {
	var hooks plugin.Hooks
	if env := ch.GetPluginsEnvironment(); env != nil {
		// we intentionally ignore the error here, because the id can be a product id
		// we are going to check if we have the hooks or not
		hooks, _ = env.HooksForPlugin(id)
		if hooks != nil {
			return hooks, nil
		}
	}

	hooks = ch.srv.hooksManager.HooksForProduct(id)
	if hooks != nil {
		return hooks, nil
	}

	return nil, fmt.Errorf("could not find hooks for id %s", id)
}

func (ch *Channels) disableBoardsIfNeeded() {
	// Disable focalboard in product mode.
	if ch.srv.Config().FeatureFlags.BoardsProduct {
		// disablePlugin automatically checks if the plugin is running or not,
		// and if it isn't, it returns an error. Therefore we ignore those errors.
		// We don't want to check here again if the plugin is enabled or not.
		appErr := ch.disablePlugin(model.PluginIdFocalboard)
		if appErr != nil && appErr.Id != "app.plugin.not_installed.app_error" && appErr.Id != "app.plugin.disabled.app_error" {
			ch.srv.Log().Error("Error disabling plugin in product mode", mlog.Err(appErr))
		}
	}
}
