// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/v8/channels/healthcheck"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
)

// HealthCheckFindingStore returns a FindingStore backed by the server's SQL
// store. Called once at job registration in initJobs so the store is
// constructed without allocating on every evaluation tick.
//
// The concrete *sqlstore.SqlStore is accessed via PlatformService.sqlStore
// (private field, same package as the rest of the app layer). We use
// NewSqlHealthCheckStore rather than wiring through the monolithic
// store.Store interface to avoid the store-layers regeneration ceremony
// (retrylayer / timerlayer / opentracinglayer).
func (a *App) HealthCheckFindingStore() healthcheck.FindingStore {
	ss := a.Srv().Platform().GetSqlStore()
	return sqlstore.NewSqlHealthCheckStore(ss)
}
