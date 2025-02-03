// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import "net/http"

func (api *API) InitJobLocal() {
	api.BaseRoutes.Jobs.Handle("", api.APILocal(getJobs)).Methods(http.MethodGet)
	api.BaseRoutes.Jobs.Handle("", api.APILocal(createJob)).Methods(http.MethodPost)
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}", api.APILocal(getJob)).Methods(http.MethodGet)
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/cancel", api.APILocal(cancelJob)).Methods(http.MethodPost)
	api.BaseRoutes.Jobs.Handle("/type/{job_type:[A-Za-z0-9_-]+}", api.APILocal(getJobsByType)).Methods(http.MethodGet)
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/status", api.APILocal(updateJobStatus)).Methods(http.MethodPatch)
}
