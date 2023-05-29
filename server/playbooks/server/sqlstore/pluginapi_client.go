// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	"github.com/mattermost/mattermost-server/server/v8/playbooks/server/playbooks"

	"github.com/mattermost/mattermost-server/server/public/model"
)

// StoreAPI is the interface exposing the underlying database, provided by pluginapi
// It is implemented by mattermost-plugin-api/Client.Store, or by the mock StoreAPI.
type StoreAPI interface {
	GetMasterDB() (*sql.DB, error)
	DriverName() string
}

// KVAPI is the key value store interface for the pluginkv stores.
// It is implemented by mattermost-plugin-api/Client.KV, or by the mock KVAPI.
type KVAPI interface {
	Get(key string, out interface{}) error
}

type ConfigurationAPI interface {
	GetConfig() *model.Config
}

// PluginAPIClient is the struct combining the interfaces defined above, which is everything
// from pluginapi that the store currently uses.
type PluginAPIClient struct {
	Store         StoreAPI
	KV            KVAPI
	Configuration ConfigurationAPI
}

// NewClient receives a pluginapi.Client and returns the PluginAPIClient, which is what the
// store will use to access pluginapi.Client.
func NewClient(serviceAdapter playbooks.ServicesAPI) PluginAPIClient {
	return PluginAPIClient{
		Store:         serviceAdapter,
		KV:            serviceAdapter,
		Configuration: serviceAdapter,
	}
}
