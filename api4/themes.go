// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

// TODO add permissions

func (api *API) InitThemes() {
	api.BaseRoutes.Themes.Handle("", api.ApiSessionRequired(getAllThemes)).Methods("GET")
	api.BaseRoutes.Themes.Handle("", api.ApiSessionRequired(saveTheme)).Methods("PUT")
	api.BaseRoutes.Theme.Handle("", api.ApiSessionRequired(getTheme)).Methods("GET")
	api.BaseRoutes.Theme.Handle("", api.ApiSessionRequired(deleteTheme)).Methods("DELETE")
}

func getAllThemes(c *Context, w http.ResponseWriter, r *http.Request) {
	themes, _ := json.Marshal(c.App.Config().ThemeSettings.Themes)
	w.Write(themes)
}

func getTheme(c *Context, w http.ResponseWriter, r *http.Request) {
	theme, ok := c.App.Config().ThemeSettings.Themes[c.Params.ThemeId]

	if !ok {
		w.WriteHeader(http.StatusNotFound)
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

	theme.PreSave()

	appCfg := c.App.Config()
	appCfg.ThemeSettings.Themes[theme.Id] = theme

	appErr := c.App.SaveConfig(appCfg, true)
	if appErr != nil {
		c.Err = model.NewAppError("saveTheme", "", nil, appErr.Error(), http.StatusInternalServerError)
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
	_, exists := c.App.Config().ThemeSettings.Themes[c.Params.ThemeId]
	if !exists {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	appCfg := c.App.Config()
	delete(appCfg.ThemeSettings.Themes, c.Params.ThemeId)

	appErr := c.App.SaveConfig(appCfg, true)
	if appErr != nil {
		c.Err = model.NewAppError("deleteTheme", "", nil, appErr.Error(), http.StatusInternalServerError)
		return
	}

	ReturnStatusOK(w)
}
