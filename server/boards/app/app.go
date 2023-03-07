// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"io"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/server/v8/boards/auth"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/config"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/metrics"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/notify"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/permissions"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/store"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/webhook"
	"github.com/mattermost/mattermost-server/server/v8/boards/utils"
	"github.com/mattermost/mattermost-server/server/v8/boards/ws"

	mm_model "github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/filestore"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

const (
	blockChangeNotifierQueueSize       = 1000
	blockChangeNotifierPoolSize        = 10
	blockChangeNotifierShutdownTimeout = time.Second * 10
)

type servicesAPI interface {
	GetUsersFromProfiles(options *mm_model.UserGetOptions) ([]*mm_model.User, error)
}

type ReadCloseSeeker = filestore.ReadCloseSeeker

type fileBackend interface {
	Reader(path string) (ReadCloseSeeker, error)
	FileExists(path string) (bool, error)
	CopyFile(oldPath, newPath string) error
	MoveFile(oldPath, newPath string) error
	WriteFile(fr io.Reader, path string) (int64, error)
	RemoveFile(path string) error
}

type Services struct {
	Auth             *auth.Auth
	Store            store.Store
	FilesBackend     fileBackend
	Webhook          *webhook.Client
	Metrics          *metrics.Metrics
	Notifications    *notify.Service
	Logger           mlog.LoggerIFace
	Permissions      permissions.PermissionsService
	SkipTemplateInit bool
	ServicesAPI      servicesAPI
}

type App struct {
	config              *config.Configuration
	store               store.Store
	auth                *auth.Auth
	wsAdapter           ws.Adapter
	filesBackend        fileBackend
	webhook             *webhook.Client
	metrics             *metrics.Metrics
	notifications       *notify.Service
	logger              mlog.LoggerIFace
	permissions         permissions.PermissionsService
	blockChangeNotifier *utils.CallbackQueue
	servicesAPI         servicesAPI

	cardLimitMux sync.RWMutex
	cardLimit    int
}

func (a *App) SetConfig(config *config.Configuration) {
	a.config = config
}

func (a *App) GetConfig() *config.Configuration {
	return a.config
}

func New(config *config.Configuration, wsAdapter ws.Adapter, services Services) *App {
	app := &App{
		config:              config,
		store:               services.Store,
		auth:                services.Auth,
		wsAdapter:           wsAdapter,
		filesBackend:        services.FilesBackend,
		webhook:             services.Webhook,
		metrics:             services.Metrics,
		notifications:       services.Notifications,
		logger:              services.Logger,
		permissions:         services.Permissions,
		blockChangeNotifier: utils.NewCallbackQueue("blockChangeNotifier", blockChangeNotifierQueueSize, blockChangeNotifierPoolSize, services.Logger),
		servicesAPI:         services.ServicesAPI,
	}
	app.initialize(services.SkipTemplateInit)
	return app
}

func (a *App) CardLimit() int {
	a.cardLimitMux.RLock()
	defer a.cardLimitMux.RUnlock()
	return a.cardLimit
}

func (a *App) SetCardLimit(cardLimit int) {
	a.cardLimitMux.Lock()
	defer a.cardLimitMux.Unlock()
	a.cardLimit = cardLimit
}

func (a *App) GetLicense() *mm_model.License {
	return a.store.GetLicense()
}
