// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

// InitHealthDashboardLocal is read-only: a local session has no user to record as the muter.
func (api *API) InitHealthDashboardLocal() {
	api.BaseRoutes.HealthFindings.Handle("", api.APILocal(getHealthFindings)).Methods(http.MethodGet)
}
