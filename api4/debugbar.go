// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"runtime"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (api *API) InitDebugBar() {
	api.BaseRoutes.DebugBar.Handle("/systeminfo", api.APISessionRequired(getSystemInfo)).Methods("GET")
}

type SystemInfo struct {
	ServerOS             string
	ServerArchitecture   string
	ServerVersion        string
	BuildHash            string
	DatabaseType         string
	DatabaseVersion      string
	LdapVendorName       string
	LdapVendorVersion    string
	ElasticServerVersion string
	ElasticServerPlugins []string
	Goroutines           int
	Cpus                 int
	CgoCalls             int64
	GoVersion            string
	GoMemStats           runtime.MemStats
}

func getSystemInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.Srv().DebugBar().IsEnabled() {
		c.Err = model.NewAppError("Api4.GetSystemInfo", "api.debugbar.getSystemInfo.disabled_debugbar.error", nil, "", http.StatusNotImplemented)
		return
	}

	// Here we are getting information regarding Elastic Search
	var elasticServerVersion string
	var elasticServerPlugins []string
	if c.App.Srv().Platform().SearchEngine.ElasticsearchEngine != nil {
		elasticServerVersion = c.App.Srv().Platform().SearchEngine.ElasticsearchEngine.GetFullVersion()
		elasticServerPlugins = c.App.Srv().Platform().SearchEngine.ElasticsearchEngine.GetPlugins()
	}

	// Here we are getting information regarding LDAP
	ldapInterface := c.App.Channels().Ldap
	var vendorName, vendorVersion string
	if ldapInterface != nil {
		vendorName, vendorVersion = ldapInterface.GetVendorNameAndVendorVersion()
	}

	// Here we are getting information regarding the database (mysql/postgres + current schema version)
	databaseType, databaseVersion := c.App.Srv().DatabaseTypeAndSchemaVersion()

	info := SystemInfo{
		GoVersion:            runtime.Version(),
		Goroutines:           runtime.NumGoroutine(),
		Cpus:                 runtime.NumCPU(),
		CgoCalls:             runtime.NumCgoCall(),
		ServerOS:             runtime.GOOS,
		ServerArchitecture:   runtime.GOARCH,
		ServerVersion:        model.CurrentVersion,
		BuildHash:            model.BuildHash,
		DatabaseType:         databaseType,
		DatabaseVersion:      databaseVersion,
		LdapVendorName:       vendorName,
		LdapVendorVersion:    vendorVersion,
		ElasticServerVersion: elasticServerVersion,
		ElasticServerPlugins: elasticServerPlugins,
	}

	runtime.ReadMemStats(&info.GoMemStats)

	if err := json.NewEncoder(w).Encode(info); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
