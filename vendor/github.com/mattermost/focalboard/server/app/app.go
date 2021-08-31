package app

import (
	"github.com/mattermost/focalboard/server/auth"
	"github.com/mattermost/focalboard/server/services/config"
	"github.com/mattermost/focalboard/server/services/metrics"
	"github.com/mattermost/focalboard/server/services/store"
	"github.com/mattermost/focalboard/server/services/webhook"
	"github.com/mattermost/focalboard/server/ws"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"

	"github.com/mattermost/mattermost-server/v6/shared/filestore"
)

type Services struct {
	Auth         *auth.Auth
	Store        store.Store
	FilesBackend filestore.FileBackend
	Webhook      *webhook.Client
	Metrics      *metrics.Metrics
	Logger       *mlog.Logger
}

type App struct {
	config       *config.Configuration
	store        store.Store
	auth         *auth.Auth
	wsAdapter    ws.Adapter
	filesBackend filestore.FileBackend
	webhook      *webhook.Client
	metrics      *metrics.Metrics
	logger       *mlog.Logger
}

func New(config *config.Configuration, wsAdapter ws.Adapter, services Services) *App {
	return &App{
		config:       config,
		store:        services.Store,
		auth:         services.Auth,
		wsAdapter:    wsAdapter,
		filesBackend: services.FilesBackend,
		webhook:      services.Webhook,
		metrics:      services.Metrics,
		logger:       services.Logger,
	}
}
