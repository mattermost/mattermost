// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

func (api *API) InitJobLocal() {
	api.BaseRoutes.Jobs.Handle("", api.ApiLocal(getJobs)).Methods("GET")
	api.BaseRoutes.Jobs.Handle("", api.ApiLocal(createJob)).Methods("POST")
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}", api.ApiLocal(getJob)).Methods("GET")
	api.BaseRoutes.Jobs.Handle("/{job_id:[A-Za-z0-9]+}/cancel", api.ApiLocal(cancelJob)).Methods("POST")
	api.BaseRoutes.Jobs.Handle("/type/{job_type:[A-Za-z0-9_-]+}", api.ApiLocal(getJobsByType)).Methods("GET")
}
