package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

func (api *API) InitThemes() {
	api.BaseRoutes.Themes.Handle("", api.ApiSessionRequired(getAllSystemThemes)).Methods("GET")
	api.BaseRoutes.Themes.Handle("/{theme_name:[A-Za-z0-9]+}", api.ApiSessionRequired(getSystemThemeByName)).Methods("GET")
	api.BaseRoutes.Themes.Handle("/{theme_name:[A-Za-z0-9]+}", api.ApiSessionRequired(createOrUpdateSystemTheme)).Methods("PUT")
	api.BaseRoutes.Themes.Handle("/{theme_name:[A-Za-z0-9]+}", api.ApiSessionRequired(deleteSystemTheme)).Methods("DELETE")
}

func getAllSystemThemes(c *Context, w http.ResponseWriter, r *http.Request) {
	systemThemes, _ := json.Marshal(c.App.Config().ThemeSettings.SystemThemes)
	w.Write(systemThemes)
}

func getSystemThemeByName(c *Context, w http.ResponseWriter, r *http.Request) {
	systemTheme, ok := c.App.Config().ThemeSettings.SystemThemes[c.Params.ThemeName]

	if !ok {
		c.SetInvalidParam("theme_name")
		return
	}

	b, err := json.Marshal(systemTheme)
	if err != nil {
		c.Err = model.NewAppError("/themes", "", nil, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(b)
}

func createOrUpdateSystemTheme(c *Context, w http.ResponseWriter, r *http.Request) {
	theme := make(map[string]string)
	err := json.NewDecoder(r.Body).Decode(&theme)
	if err != nil {
		c.SetInvalidParam("theme")
		return
	}

	appCfg := c.App.Config()
	appCfg.ThemeSettings.SystemThemes[c.Params.ThemeName] = theme

	appErr := c.App.SaveConfig(appCfg, true)
	if appErr != nil {
		c.Err = model.NewAppError("/themes", "", nil, appErr.Error(), http.StatusInternalServerError)
		return
	}

	ReturnStatusOK(w)
}

func deleteSystemTheme(c *Context, w http.ResponseWriter, r *http.Request) {
	_, exists := c.App.Config().ThemeSettings.SystemThemes[c.Params.ThemeName]
	if !exists {
		c.SetInvalidParam("theme_name")
		return
	}

	appCfg := c.App.Config()
	delete(appCfg.ThemeSettings.SystemThemes, c.Params.ThemeName)

	appErr := c.App.SaveConfig(appCfg, true)
	if appErr != nil {
		c.Err = model.NewAppError("/themes", "", nil, appErr.Error(), http.StatusInternalServerError)
		return
	}

	ReturnStatusOK(w)
}
