// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"path"

	fbauth "github.com/mattermost/focalboard/server/auth"
	fbserver "github.com/mattermost/focalboard/server/server"
	fbconfig "github.com/mattermost/focalboard/server/services/config"
	fbstore "github.com/mattermost/focalboard/server/services/store"
	"github.com/mattermost/focalboard/server/services/store/mattermostauthlayer"
	fbsqlstore "github.com/mattermost/focalboard/server/services/store/sqlstore"
	fbws "github.com/mattermost/focalboard/server/ws"
)

func (s *Server) setupFocalboard() error {
	cfg := s.Config()
	filesS3Config := fbconfig.AmazonS3Config{}
	if cfg.FileSettings.AmazonS3AccessKeyId != nil {
		filesS3Config.AccessKeyID = *cfg.FileSettings.AmazonS3AccessKeyId
	}
	if cfg.FileSettings.AmazonS3SecretAccessKey != nil {
		filesS3Config.SecretAccessKey = *cfg.FileSettings.AmazonS3SecretAccessKey
	}
	if cfg.FileSettings.AmazonS3Bucket != nil {
		filesS3Config.Bucket = *cfg.FileSettings.AmazonS3Bucket
	}
	if cfg.FileSettings.AmazonS3PathPrefix != nil {
		filesS3Config.PathPrefix = *cfg.FileSettings.AmazonS3PathPrefix
	}
	if cfg.FileSettings.AmazonS3Region != nil {
		filesS3Config.Region = *cfg.FileSettings.AmazonS3Region
	}
	if cfg.FileSettings.AmazonS3Endpoint != nil {
		filesS3Config.Endpoint = *cfg.FileSettings.AmazonS3Endpoint
	}
	if cfg.FileSettings.AmazonS3SSL != nil {
		filesS3Config.SSL = *cfg.FileSettings.AmazonS3SSL
	}
	if cfg.FileSettings.AmazonS3SignV2 != nil {
		filesS3Config.SignV2 = *cfg.FileSettings.AmazonS3SignV2
	}
	if cfg.FileSettings.AmazonS3SSE != nil {
		filesS3Config.SSE = *cfg.FileSettings.AmazonS3SSE
	}
	if cfg.FileSettings.AmazonS3Trace != nil {
		filesS3Config.Trace = *cfg.FileSettings.AmazonS3Trace
	}

	logger := s.Log

	fbCfg := &fbconfig.Configuration{
		ServerRoot:              *cfg.ServiceSettings.SiteURL,
		Port:                    -1,
		DBType:                  *cfg.SqlSettings.DriverName,
		DBConfigString:          *cfg.SqlSettings.DataSource,
		DBTablePrefix:           "focalboard_",
		UseSSL:                  false,
		SecureCookie:            true,
		WebPath:                 path.Join(*cfg.PluginSettings.Directory, "focalboard", "pack"),
		FilesDriver:             *cfg.FileSettings.DriverName,
		FilesPath:               *cfg.FileSettings.Directory,
		FilesS3Config:           filesS3Config,
		Telemetry:               true,
		WebhookUpdate:           []string{},
		SessionExpireTime:       2592000,
		SessionRefreshTime:      18000,
		LocalOnly:               false,
		EnableLocalMode:         false,
		LocalModeSocketLocation: "",
		AuthMode:                "mattermost",
	}
	var db fbstore.Store
	db, err := fbsqlstore.New(fbCfg.DBType,
		fbCfg.DBConfigString,
		fbCfg.DBTablePrefix,
		logger,
		s.sqlStore.GetMaster().Db)
	if err != nil {
		return fmt.Errorf("error initializing the DB: %w", err)
	}
	if fbCfg.AuthMode == fbserver.MattermostAuthMod {
		layeredStore, err2 := mattermostauthlayer.New(fbCfg.DBType, s.sqlStore.GetMaster().Db, db, logger)
		if err2 != nil {
			return fmt.Errorf("error initializing the DB: %w", err2)
		}
		db = layeredStore
	}

	serverID := ""
	pluginAdapter := fbws.NewPluginAdapter(New(ServerConnector(s)), fbauth.New(fbCfg, db), logger)

	server, err := fbserver.New(fbCfg, "", db, logger, serverID, pluginAdapter)
	if err != nil {
		return fmt.Errorf("error initializing the server: %w", err)
	}

	s.fbServer = server
	return nil
}
