// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"runtime"

	"github.com/mattermost/mattermost-server/v6/model"
)

func (a *App) GetDebugBarInfo() (*model.DebugBarInfo, *model.AppError) {
	sessionsCount, err := a.Srv().Store().Session().AnalyticsSessionCount()
	if err != nil {
		return nil, model.NewAppError("GetDebugBarInfo", "debugbar.info.session-count.error", nil, err.Error(), http.StatusInternalServerError)
	}
	// Here we are getting information regarding Elastic Search
	var elasticServerVersion string
	var elasticServerPlugins []string
	if a.Srv().Platform().SearchEngine.ElasticsearchEngine != nil {
		elasticServerVersion = a.Srv().Platform().SearchEngine.ElasticsearchEngine.GetFullVersion()
		elasticServerPlugins = a.Srv().Platform().SearchEngine.ElasticsearchEngine.GetPlugins()
	}

	// Here we are getting information regarding LDAP
	ldapInterface := a.Channels().Ldap
	var vendorName, vendorVersion string
	if ldapInterface != nil {
		vendorName, vendorVersion = ldapInterface.GetVendorNameAndVendorVersion()
	}

	// Here we are getting information regarding the database (mysql/postgres + current schema version)
	databaseType, databaseVersion := a.Srv().DatabaseTypeAndSchemaVersion()

	info := model.DebugBarInfo{
		SessionsCount:        sessionsCount,
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

	totalSockets := a.TotalWebsocketConnections()
	totalMasterDb := a.Srv().Store().TotalMasterDbConnections()
	totalReadDb := a.Srv().Store().TotalReadDbConnections()

	// If in HA mode then aggregate all the stats
	if a.Cluster() != nil && *a.Config().ClusterSettings.Enable {
		stats, appErr := a.Cluster().GetClusterStats()
		if appErr != nil {
			return nil, appErr
		}

		for _, stat := range stats {
			totalSockets = totalSockets + stat.TotalWebsocketConnections
			totalMasterDb = totalMasterDb + stat.TotalMasterDbConnections
			totalReadDb = totalReadDb + stat.TotalReadDbConnections
		}
	}

	info.WebSocketConnections = totalSockets
	info.MasterDBConnections = totalMasterDb
	info.ReadDBConnections = totalReadDb

	return &info, nil
}
