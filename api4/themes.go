// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
)

// TODO add permissions
// TODO errors

func (api *API) InitThemes() {
	api.BaseRoutes.Themes.Handle("", api.ApiSessionRequired(getAllThemes)).Methods("GET")
	api.BaseRoutes.Themes.Handle("", api.ApiSessionRequired(saveTheme)).Methods("PUT")
	api.BaseRoutes.Theme.Handle("", api.ApiSessionRequired(getTheme)).Methods("GET")
	api.BaseRoutes.Theme.Handle("", api.ApiSessionRequired(deleteTheme)).Methods("DELETE")
}

func getAllThemes(c *Context, w http.ResponseWriter, r *http.Request) {
	themes, appErr := c.App.Srv().Store.Theme().GetAll()
	if appErr != nil {
		c.Err = appErr
		return
	}

	themeMap := map[string]*model.Theme{}
	for _, theme := range themes {
		themeMap[theme.Id] = theme
	}

	b, err := json.Marshal(themes)
	if err != nil {
		c.Err = model.NewAppError("getAllThemes", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func getTheme(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Params.ThemeId == "" {
		c.SetInvalidParam("theme_id")
		return
	}

	theme, appErr := c.App.Srv().Store.Theme().Get(c.Params.ThemeId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(theme)
	if err != nil {
		c.Err = model.NewAppError("getTheme", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func saveTheme(c *Context, w http.ResponseWriter, r *http.Request) {
	var theme *model.Theme
	err := json.NewDecoder(r.Body).Decode(&theme)
	if err != nil {
		c.SetInvalidParam("theme")
		return
	}

	theme, appErr := c.App.Srv().Store.Theme().Save(theme)
	if err != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(theme)
	if err != nil {
		c.Err = model.NewAppError("getTheme", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func deleteTheme(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Params.ThemeId == "" {
		c.SetInvalidParam("theme_id")
		return
	}

	err := c.App.Srv().Store.Theme().Delete(c.Params.ThemeId)
	if err != nil {
		c.Err = err
		return
	}

	ReturnStatusOK(w)
}
