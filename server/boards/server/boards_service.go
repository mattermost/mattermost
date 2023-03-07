// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"fmt"
	"net/http"
	"sync"

	"github.com/mattermost/mattermost-server/server/v8/boards/auth"
	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/config"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/notify"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/permissions/mmpermissions"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/store"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/store/mattermostauthlayer"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/store/sqlstore"
	"github.com/mattermost/mattermost-server/server/v8/boards/ws"

	mm_model "github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/plugin"

	"github.com/mattermost/mattermost-plugin-api/cluster"
)

const (
	boardsFeatureFlagName = "BoardsFeatureFlags"
	PluginName            = "focalboard"
	SharedBoardsName      = "enablepublicsharedboards"

	notifyFreqCardSecondsKey  = "notify_freq_card_seconds"
	notifyFreqBoardSecondsKey = "notify_freq_board_seconds"
)

type BoardsEmbed struct {
	OriginalPath string `json:"originalPath"`
	TeamID       string `json:"teamID"`
	ViewID       string `json:"viewID"`
	BoardID      string `json:"boardID"`
	CardID       string `json:"cardID"`
	ReadToken    string `json:"readToken,omitempty"`
}

type BoardsService struct {
	// configurationLock synchronizes access to the configuration.
	configurationLock sync.RWMutex

	// configuration is the active plugin configuration. Consult getConfiguration and
	// setConfiguration for usage.
	configuration *configuration

	server          *Server
	wsPluginAdapter ws.PluginAdapterInterface

	servicesAPI model.ServicesAPI
	logger      mlog.LoggerIFace
}

func NewBoardsServiceForTest(server *Server, wsPluginAdapter ws.PluginAdapterInterface,
	api model.ServicesAPI, logger mlog.LoggerIFace) *BoardsService {
	return &BoardsService{
		server:          server,
		wsPluginAdapter: wsPluginAdapter,
		servicesAPI:     api,
		logger:          logger,
	}
}

func NewBoardsService(api model.ServicesAPI) (*BoardsService, error) {
	mmconfig := api.GetConfig()
	logger := api.GetLogger()

	baseURL := ""
	if mmconfig.ServiceSettings.SiteURL != nil {
		baseURL = *mmconfig.ServiceSettings.SiteURL
	}
	serverID := api.GetDiagnosticID()
	cfg := CreateBoardsConfig(*mmconfig, baseURL, serverID)
	sqlDB, err := api.GetMasterDB()
	if err != nil {
		return nil, fmt.Errorf("cannot access database while initializing Boards: %w", err)
	}

	storeParams := sqlstore.Params{
		DBType:           cfg.DBType,
		ConnectionString: cfg.DBConfigString,
		TablePrefix:      cfg.DBTablePrefix,
		Logger:           logger,
		DB:               sqlDB,
		IsPlugin:         true,
		NewMutexFn: func(name string) (*cluster.Mutex, error) {
			return cluster.NewMutex(&mutexAPIAdapter{api: api}, name)
		},
		ServicesAPI: api,
		ConfigFn:    api.GetConfig,
	}

	var db store.Store
	db, err = sqlstore.New(storeParams)
	if err != nil {
		return nil, fmt.Errorf("error initializing the DB: %w", err)
	}
	if cfg.AuthMode == MattermostAuthMod {
		layeredStore, err2 := mattermostauthlayer.New(cfg.DBType, sqlDB, db, logger, api, storeParams.TablePrefix)
		if err2 != nil {
			return nil, fmt.Errorf("error initializing the DB: %w", err2)
		}
		db = layeredStore
	}

	permissionsService := mmpermissions.New(db, api, logger)

	wsPluginAdapter := ws.NewPluginAdapter(api, auth.New(cfg, db, permissionsService), db, logger)

	backendParams := notifyBackendParams{
		cfg:         cfg,
		servicesAPI: api,
		appAPI:      &appAPI{store: db},
		permissions: permissionsService,
		serverRoot:  baseURL + "/boards",
		logger:      logger,
	}

	var notifyBackends []notify.Backend

	mentionsBackend, err := createMentionsNotifyBackend(backendParams)
	if err != nil {
		return nil, fmt.Errorf("error creating mention notifications backend: %w", err)
	}
	notifyBackends = append(notifyBackends, mentionsBackend)

	subscriptionsBackend, err2 := createSubscriptionsNotifyBackend(backendParams)
	if err2 != nil {
		return nil, fmt.Errorf("error creating subscription notifications backend: %w", err2)
	}
	notifyBackends = append(notifyBackends, subscriptionsBackend)
	mentionsBackend.AddListener(subscriptionsBackend)

	params := Params{
		Cfg:                cfg,
		SingleUserToken:    "",
		DBStore:            db,
		Logger:             logger,
		ServerID:           serverID,
		WSAdapter:          wsPluginAdapter,
		NotifyBackends:     notifyBackends,
		PermissionsService: permissionsService,
		IsPlugin:           true,
	}

	server, err := New(params)
	if err != nil {
		return nil, fmt.Errorf("error initializing the server: %w", err)
	}

	backendParams.appAPI.init(db, server.App())

	// ToDo: Cloud Limits have been disabled by design. We should
	// revisit the decision and update the related code accordingly
	/*
		if utils.IsCloudLicense(api.GetLicense()) {
			limits, err := api.GetCloudLimits()
			if err != nil {
				return nil, fmt.Errorf("error fetching cloud limits when starting Boards: %w", err)
			}

			if err := server.App().SetCloudLimits(limits); err != nil {
				return nil, fmt.Errorf("error setting cloud limits when starting Boards: %w", err)
			}
		}
	*/

	return &BoardsService{
		server:          server,
		wsPluginAdapter: wsPluginAdapter,
		servicesAPI:     api,
		logger:          logger,
	}, nil
}

func (b *BoardsService) Start() error {
	if err := b.server.Start(); err != nil {
		return fmt.Errorf("error starting Boards server: %w", err)
	}

	b.servicesAPI.RegisterRouter(b.server.GetRootRouter())

	b.logger.Info("Boards product successfully started.")

	return nil
}

func (b *BoardsService) Stop() error {
	return b.server.Shutdown()
}

//
// These callbacks are called automatically by the suite server.
//

func (b *BoardsService) MessageWillBePosted(_ *plugin.Context, post *mm_model.Post) (*mm_model.Post, string) {
	return postWithBoardsEmbed(post), ""
}

func (b *BoardsService) MessageWillBeUpdated(_ *plugin.Context, newPost, _ *mm_model.Post) (*mm_model.Post, string) {
	return postWithBoardsEmbed(newPost), ""
}

func (b *BoardsService) OnWebSocketConnect(webConnID, userID string) {
	b.wsPluginAdapter.OnWebSocketConnect(webConnID, userID)
}

func (b *BoardsService) OnWebSocketDisconnect(webConnID, userID string) {
	b.wsPluginAdapter.OnWebSocketDisconnect(webConnID, userID)
}

func (b *BoardsService) WebSocketMessageHasBeenPosted(webConnID, userID string, req *mm_model.WebSocketRequest) {
	b.wsPluginAdapter.WebSocketMessageHasBeenPosted(webConnID, userID, req)
}

func (b *BoardsService) OnPluginClusterEvent(_ *plugin.Context, ev mm_model.PluginClusterEvent) {
	b.wsPluginAdapter.HandleClusterEvent(ev)
}

func (b *BoardsService) OnCloudLimitsUpdated(limits *mm_model.ProductLimits) {
	if err := b.server.App().SetCloudLimits(limits); err != nil {
		b.logger.Error("Error setting the cloud limits for Boards", mlog.Err(err))
	}
}

func (b *BoardsService) Config() *config.Configuration {
	return b.server.Config()
}

func (b *BoardsService) ClientConfig() *model.ClientConfig {
	return b.server.App().GetClientConfig()
}

// ServeHTTP demonstrates a plugin that handles HTTP requests by greeting the world.
func (b *BoardsService) ServeHTTP(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	router := b.server.GetRootRouter()
	router.ServeHTTP(w, r)
}
