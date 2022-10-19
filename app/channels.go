// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"runtime"
	"strings"
	"sync"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/app/imaging"
	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/product"
	"github.com/mattermost/mattermost-server/v6/services/imageproxy"
	"github.com/mattermost/mattermost-server/v6/shared/filestore"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

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

	collectionTypes map[string]string   // pluginId -> collectionType
	topicTypes      map[string][]string // collectionType -> topicType array
}

func init() {
	RegisterProduct("channels", ProductManifest{
		Initializer: func(s *Server, services map[ServiceKey]any) (Product, error) {
			return NewChannels(s, services)
		},
		Dependencies: map[ServiceKey]struct{}{
			ConfigKey:    {},
			LicenseKey:   {},
			FilestoreKey: {},
		},
	})
}

func NewChannels(s *Server, services map[ServiceKey]any) (*Channels, error) {
	ch := &Channels{
		srv:             s,
		imageProxy:      imageproxy.MakeImageProxy(s.platform, s.httpService, s.Log()),
		uploadLockMap:   map[string]bool{},
		collectionTypes: map[string]string{},
		topicTypes:      map[string][]string{},
	}

	// To get another service:
	// 1. Prepare the service interface
	// 2. Add the field to *Channels
	// 3. Add the service key to the slice.
	// 4. Add a new case in the switch statement.
	requiredServices := []ServiceKey{
		ConfigKey,
		LicenseKey,
		FilestoreKey,
	}
	for _, svcKey := range requiredServices {
		svc, ok := services[svcKey]
		if !ok {
			return nil, fmt.Errorf("Service %s not passed", svcKey)
		}
		switch svcKey {
		// Keep adding more services here
		case ConfigKey:
			cfgSvc, ok := svc.(product.ConfigService)
			if !ok {
				return nil, errors.New("Config service did not satisfy ConfigSvc interface")
			}
			ch.cfgSvc = cfgSvc
		case FilestoreKey:
			filestore, ok := svc.(filestore.FileBackend)
			if !ok {
				return nil, errors.New("Filestore service did not satisfy FileBackend interface")
			}
			ch.filestore = filestore
		case LicenseKey:
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
	services[RouterKey] = ch.routerSvc

	// Setup routes.
	pluginsRoute := ch.srv.Router.PathPrefix("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}").Subrouter()
	pluginsRoute.HandleFunc("", ch.ServePluginRequest)
	pluginsRoute.HandleFunc("/public/{public_file:.*}", ch.ServePluginPublicRequest)
	pluginsRoute.HandleFunc("/{anything:.*}", ch.ServePluginRequest)

	services[PostKey] = &postServiceWrapper{
		app: &App{ch: ch},
	}

	services[PermissionsKey] = &permissionsServiceWrapper{
		app: &App{ch: ch},
	}

	services[TeamKey] = &teamServiceWrapper{
		app: &App{ch: ch},
	}

	services[BotKey] = &botServiceWrapper{
		app: &App{ch: ch},
	}

	services[HooksKey] = &hooksService{
		ch: ch,
	}

	services[UserKey] = &App{ch: ch}

	services[PreferencesKey] = &preferencesServiceWrapper{
		app: &App{ch: ch},
	}

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

// Ensure hooksService implements `product.HooksService`
var _ product.HooksService = (*hooksService)(nil)

type hooksService struct {
	ch *Channels
}

func (s *hooksService) RegisterHooks(productID string, hooks any) error {
	if s.ch.pluginsEnvironment == nil {
		return errors.New("could not find plugins environment")
	}

	return s.ch.pluginsEnvironment.AddProduct(productID, hooks)
}
