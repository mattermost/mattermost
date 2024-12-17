// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type CustomProfileAttribute struct {
	Id       string `json:"id"`
	Name     string `json:"name"`
	DataType string `json:"dataType"`
}

func (api *API) InitCustomAttributes() {
	api.BaseRoutes.CustomProfileAttributes.Handle("/fields", api.APISessionRequired(getCustomProfileAttributes)).Methods(http.MethodGet)
}

func getCustomProfileAttributes(c *Context, w http.ResponseWriter, r *http.Request) {
	attributes := []CustomProfileAttribute{
		{Id: "123", Name: "Rank", DataType: "text"},
		{Id: "456", Name: "CO", DataType: "text"},
		{Id: "789", Name: "Base", DataType: "text"},
	}

	js, err := json.Marshal(attributes)
	if err != nil {
		c.Err = model.NewAppError("getCustomProfileAttributes", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
		return
	}
}
