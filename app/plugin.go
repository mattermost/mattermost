// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"

	builtinplugin "github.com/mattermost/mattermost-server/app/plugin"
	"github.com/mattermost/mattermost-server/app/plugin/jira"
	"github.com/mattermost/mattermost-server/app/plugin/ldapextras"
	"github.com/mattermost/mattermost-server/app/plugin/zoom"

	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/pluginenv"
	"github.com/mattermost/mattermost-server/plugin/rpcplugin"
	"github.com/mattermost/mattermost-server/plugin/rpcplugin/sandbox"
)

var prepackagedPlugins map[string]func(string) ([]byte, error) = map[string]func(string) ([]byte, error){
	"jira": jira.Asset,
	"zoom": zoom.Asset,
}

func (a *App) notifyPluginStatusesChanged() error {
	pluginStatuses, err := a.GetClusterPluginStatuses()
	if err != nil {
		return err
	}

	// Notify any system admins.
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PLUGIN_STATUSES_CHANGED, "", "", "", nil)
	message.Add("plugin_statuses", pluginStatuses)
	message.Broadcast.ContainsSensitiveData = true
	a.Publish(message)

	return nil
}

func (a *App) setPluginStatusState(id string, state int) error {
	if _, ok := a.pluginStatuses[id]; !ok {
		return nil
	}

	a.pluginStatuses[id].State = state

	return a.notifyPluginStatusesChanged()
}

func (a *App) initBuiltInPlugins() {
	plugins := map[string]builtinplugin.Plugin{
		"ldapextras": &ldapextras.Plugin{},
	}
	for id, p := range plugins {
		mlog.Debug("Initializing built-in plugin", mlog.String("plugin_id", id))
		api := &BuiltInPluginAPI{
			id:     id,
			router: a.Srv.Router.PathPrefix("/plugins/" + id).Subrouter(),
			app:    a,
		}
		p.Initialize(api)
	}
	a.AddConfigListener(func(before, after *model.Config) {
		for _, p := range plugins {
			p.OnConfigurationChange()
		}
	})
	for _, p := range plugins {
		p.OnConfigurationChange()
	}
}

func (a *App) setPluginsActive(activate bool) {
	if a.PluginEnv == nil {
		mlog.Error(fmt.Sprintf("Cannot setPluginsActive(%t): plugin env not initialized", activate))
		return
	}

	plugins, err := a.PluginEnv.Plugins()
	if err != nil {
		mlog.Error(fmt.Sprintf("Cannot setPluginsActive(%t)", activate), mlog.Err(err))
		return
	}

	for _, plugin := range plugins {
		if plugin.Manifest == nil {
			continue
		}

		enabled := false
		if state, ok := a.Config().PluginSettings.PluginStates[plugin.Manifest.Id]; ok {
			enabled = state.Enable
		}

		a.pluginStatuses[plugin.Manifest.Id] = &model.PluginStatus{
			ClusterId:   a.GetClusterId(),
			PluginId:    plugin.Manifest.Id,
			PluginPath:  filepath.Dir(plugin.ManifestPath),
			IsSandboxed: a.IsPluginSandboxSupported,
			Name:        plugin.Manifest.Name,
			Description: plugin.Manifest.Description,
			Version:     plugin.Manifest.Version,
		}

		if activate && enabled {
			a.setPluginActive(plugin, activate)
		} else if !activate {
			a.setPluginActive(plugin, activate)
		}
	}

	if err := a.notifyPluginStatusesChanged(); err != nil {
		mlog.Error("failed to notify plugin status changed", mlog.Err(err))
	}
}

func (a *App) setPluginActiveById(id string, activate bool) {
	plugins, err := a.PluginEnv.Plugins()
	if err != nil {
		mlog.Error(fmt.Sprintf("Cannot setPluginActiveById(%t)", activate), mlog.String("plugin_id", id), mlog.Err(err))
		return
	}

	for _, plugin := range plugins {
		if plugin.Manifest != nil && plugin.Manifest.Id == id {
			a.setPluginActive(plugin, activate)
		}
	}
}

func (a *App) setPluginActive(plugin *model.BundleInfo, activate bool) {
	if plugin.Manifest == nil {
		return
	}

	id := plugin.Manifest.Id

	active := a.PluginEnv.IsPluginActive(id)

	if activate {
		if !active {
			if err := a.activatePlugin(plugin.Manifest); err != nil {
				mlog.Error("Plugin failed to activate", mlog.String("plugin_id", plugin.Manifest.Id), mlog.String("err", err.DetailedError))
			}
		}

	} else if !activate {
		if active {
			if err := a.deactivatePlugin(plugin.Manifest); err != nil {
				mlog.Error("Plugin failed to deactivate", mlog.String("plugin_id", plugin.Manifest.Id), mlog.String("err", err.DetailedError))
			}
		} else {
			if err := a.setPluginStatusState(plugin.Manifest.Id, model.PluginStateNotRunning); err != nil {
				mlog.Error("Plugin status state failed to update", mlog.String("plugin_id", plugin.Manifest.Id), mlog.String("err", err.Error()))
			}
		}
	}
}

func (a *App) activatePlugin(manifest *model.Manifest) *model.AppError {
	mlog.Debug("Activating plugin", mlog.String("plugin_id", manifest.Id))

	if err := a.setPluginStatusState(manifest.Id, model.PluginStateStarting); err != nil {
		return model.NewAppError("activatePlugin", "app.plugin.set_plugin_status_state.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	onError := func(err error) {
		mlog.Debug("Plugin failed to stay running", mlog.String("plugin_id", manifest.Id), mlog.Err(err))

		if err := a.setPluginStatusState(manifest.Id, model.PluginStateFailedToStayRunning); err != nil {
			mlog.Error("Failed to record plugin status", mlog.String("plugin_id", manifest.Id), mlog.Err(err))
		}
	}

	if err := a.PluginEnv.ActivatePlugin(manifest.Id, onError); err != nil {
		if err := a.setPluginStatusState(manifest.Id, model.PluginStateFailedToStart); err != nil {
			return model.NewAppError("activatePlugin", "app.plugin.activate.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		return model.NewAppError("activatePlugin", "app.plugin.activate.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if err := a.setPluginStatusState(manifest.Id, model.PluginStateRunning); err != nil {
		return model.NewAppError("activatePlugin", "app.plugin.activate.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	if manifest.HasClient() {
		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PLUGIN_ACTIVATED, "", "", "", nil)
		message.Add("manifest", manifest.ClientManifest())
		a.Publish(message)
	}

	mlog.Info("Activated plugin", mlog.String("plugin_id", manifest.Id))
	return nil
}

func (a *App) deactivatePlugin(manifest *model.Manifest) *model.AppError {
	mlog.Debug("Deactivating plugin", mlog.String("plugin_id", manifest.Id))

	if err := a.setPluginStatusState(manifest.Id, model.PluginStateStopping); err != nil {
		return model.NewAppError("EnablePlugin", "app.plugin.deactivate.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := a.PluginEnv.DeactivatePlugin(manifest.Id); err != nil {
		return model.NewAppError("deactivatePlugin", "app.plugin.deactivate.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	a.UnregisterPluginCommands(manifest.Id)

	if manifest.HasClient() {
		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PLUGIN_DEACTIVATED, "", "", "", nil)
		message.Add("manifest", manifest.ClientManifest())
		a.Publish(message)
	}

	if err := a.setPluginStatusState(manifest.Id, model.PluginStateNotRunning); err != nil {
		return model.NewAppError("deactivatePlugin", "app.plugin.deactivate.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	mlog.Info("Deactivated plugin", mlog.String("plugin_id", manifest.Id))
	return nil
}

// InstallPlugin unpacks and installs a plugin but does not activate it.
func (a *App) InstallPlugin(pluginFile io.Reader) (*model.Manifest, *model.AppError) {
	return a.installPlugin(pluginFile, false)
}

func (a *App) installPlugin(pluginFile io.Reader, allowPrepackaged bool) (*model.Manifest, *model.AppError) {
	if a.PluginEnv == nil || !*a.Config().PluginSettings.Enable {
		return nil, model.NewAppError("installPlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	tmpDir, err := ioutil.TempDir("", "plugintmp")
	if err != nil {
		return nil, model.NewAppError("installPlugin", "app.plugin.filesystem.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer os.RemoveAll(tmpDir)

	if err := utils.ExtractTarGz(pluginFile, tmpDir); err != nil {
		return nil, model.NewAppError("installPlugin", "app.plugin.extract.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	tmpPluginDir := tmpDir
	dir, err := ioutil.ReadDir(tmpDir)
	if err != nil {
		return nil, model.NewAppError("installPlugin", "app.plugin.filesystem.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if len(dir) == 1 && dir[0].IsDir() {
		tmpPluginDir = filepath.Join(tmpPluginDir, dir[0].Name())
	}

	manifest, _, err := model.FindManifest(tmpPluginDir)
	if err != nil {
		return nil, model.NewAppError("installPlugin", "app.plugin.manifest.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	_, isPrepackaged := prepackagedPlugins[manifest.Id]
	if isPrepackaged && !allowPrepackaged {
		return nil, model.NewAppError("installPlugin", "app.plugin.prepackaged.app_error", nil, "", http.StatusBadRequest)
	}

	if !plugin.IsValidId(manifest.Id) {
		return nil, model.NewAppError("installPlugin", "app.plugin.invalid_id.app_error", map[string]interface{}{"Min": plugin.MinIdLength, "Max": plugin.MaxIdLength, "Regex": plugin.ValidId.String()}, "", http.StatusBadRequest)
	}

	bundles, err := a.PluginEnv.Plugins()
	if err != nil {
		return nil, model.NewAppError("installPlugin", "app.plugin.install.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, bundle := range bundles {
		if bundle.Manifest != nil && bundle.Manifest.Id == manifest.Id {
			return nil, model.NewAppError("installPlugin", "app.plugin.install_id.app_error", nil, "", http.StatusBadRequest)
		}
	}

	pluginPath := filepath.Join(a.PluginEnv.SearchPath(), manifest.Id)
	err = utils.CopyDir(tmpPluginDir, pluginPath)
	if err != nil {
		return nil, model.NewAppError("installPlugin", "app.plugin.mvdir.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	a.pluginStatuses[manifest.Id] = &model.PluginStatus{
		ClusterId:     a.GetClusterId(),
		PluginId:      manifest.Id,
		PluginPath:    pluginPath,
		State:         model.PluginStateNotRunning,
		IsSandboxed:   a.IsPluginSandboxSupported,
		IsPrepackaged: isPrepackaged,
		Name:          manifest.Name,
		Description:   manifest.Description,
		Version:       manifest.Version,
	}

	if err := a.notifyPluginStatusesChanged(); err != nil {
		mlog.Error("failed to notify plugin status changed", mlog.Err(err))
	}

	return manifest, nil
}

// GetPlugins returned the plugins installed on this server, including the manifests needed to
// enable plugins with web functionality.
func (a *App) GetPlugins() (*model.PluginsResponse, *model.AppError) {
	if a.PluginEnv == nil || !*a.Config().PluginSettings.Enable {
		return nil, model.NewAppError("GetPlugins", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins, err := a.PluginEnv.Plugins()
	if err != nil {
		return nil, model.NewAppError("GetPlugins", "app.plugin.get_plugins.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	resp := &model.PluginsResponse{Active: []*model.PluginInfo{}, Inactive: []*model.PluginInfo{}}
	for _, plugin := range plugins {
		if plugin.Manifest == nil {
			continue
		}

		info := &model.PluginInfo{
			Manifest: *plugin.Manifest,
		}
		_, info.Prepackaged = prepackagedPlugins[plugin.Manifest.Id]
		if a.PluginEnv.IsPluginActive(plugin.Manifest.Id) {
			resp.Active = append(resp.Active, info)
		} else {
			resp.Inactive = append(resp.Inactive, info)
		}
	}

	return resp, nil
}

func (a *App) GetActivePluginManifests() ([]*model.Manifest, *model.AppError) {
	if a.PluginEnv == nil || !*a.Config().PluginSettings.Enable {
		return nil, model.NewAppError("GetActivePluginManifests", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins := a.PluginEnv.ActivePlugins()

	manifests := make([]*model.Manifest, len(plugins))
	for i, plugin := range plugins {
		manifests[i] = plugin.Manifest
	}

	return manifests, nil
}

// GetPluginStatuses returns the status for plugins installed on this server.
func (a *App) GetPluginStatuses() (model.PluginStatuses, *model.AppError) {
	if !*a.Config().PluginSettings.Enable {
		return nil, model.NewAppError("GetPluginStatuses", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	pluginStatuses := make([]*model.PluginStatus, 0, len(a.pluginStatuses))
	for _, pluginStatus := range a.pluginStatuses {
		pluginStatuses = append(pluginStatuses, pluginStatus)
	}

	return pluginStatuses, nil
}

// GetClusterPluginStatuses returns the status for plugins installed anywhere in the cluster.
func (a *App) GetClusterPluginStatuses() (model.PluginStatuses, *model.AppError) {
	pluginStatuses, err := a.GetPluginStatuses()
	if err != nil {
		return nil, err
	}

	if a.Cluster != nil && *a.Config().ClusterSettings.Enable {
		clusterPluginStatuses, err := a.Cluster.GetPluginStatuses()
		if err != nil {
			return nil, model.NewAppError("GetClusterPluginStatuses", "app.plugin.get_cluster_plugin_statuses.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		pluginStatuses = append(pluginStatuses, clusterPluginStatuses...)
	}

	return pluginStatuses, nil
}

func (a *App) RemovePlugin(id string) *model.AppError {
	return a.removePlugin(id, false)
}

func (a *App) removePlugin(id string, allowPrepackaged bool) *model.AppError {
	if a.PluginEnv == nil || !*a.Config().PluginSettings.Enable {
		return model.NewAppError("removePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if _, ok := prepackagedPlugins[id]; ok && !allowPrepackaged {
		return model.NewAppError("removePlugin", "app.plugin.prepackaged.app_error", nil, "", http.StatusBadRequest)
	}

	plugins, err := a.PluginEnv.Plugins()
	if err != nil {
		return model.NewAppError("removePlugin", "app.plugin.deactivate.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	var manifest *model.Manifest
	var pluginPath string
	for _, p := range plugins {
		if p.Manifest != nil && p.Manifest.Id == id {
			manifest = p.Manifest
			pluginPath = filepath.Dir(p.ManifestPath)
			break
		}
	}

	if manifest == nil {
		return model.NewAppError("removePlugin", "app.plugin.not_installed.app_error", nil, "", http.StatusBadRequest)
	}

	if a.PluginEnv.IsPluginActive(id) {
		err := a.deactivatePlugin(manifest)
		if err != nil {
			return err
		}
	}

	err = os.RemoveAll(pluginPath)
	if err != nil {
		return model.NewAppError("removePlugin", "app.plugin.remove.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	delete(a.pluginStatuses, manifest.Id)
	if err := a.notifyPluginStatusesChanged(); err != nil {
		mlog.Error("failed to notify plugin status changed", mlog.Err(err))
	}

	return nil
}

// EnablePlugin will set the config for an installed plugin to enabled, triggering asynchronous
// activation if inactive anywhere in the cluster.
func (a *App) EnablePlugin(id string) *model.AppError {
	if a.PluginEnv == nil || !*a.Config().PluginSettings.Enable {
		return model.NewAppError("EnablePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins, err := a.PluginEnv.Plugins()
	if err != nil {
		return model.NewAppError("EnablePlugin", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var manifest *model.Manifest
	for _, p := range plugins {
		if p.Manifest.Id == id {
			manifest = p.Manifest
			break
		}
	}

	if manifest == nil {
		return model.NewAppError("EnablePlugin", "app.plugin.not_installed.app_error", nil, "", http.StatusBadRequest)
	}

	if err := a.setPluginStatusState(manifest.Id, model.PluginStateStarting); err != nil {
		return model.NewAppError("EnablePlugin", "app.plugin.set_plugin_status_state.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	a.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.PluginStates[id] = &model.PluginState{Enable: true}
	})

	if err := a.SaveConfig(a.Config(), true); err != nil {
		if err.Id == "ent.cluster.save_config.error" {
			return model.NewAppError("EnablePlugin", "app.plugin.cluster.save_config.app_error", nil, "", http.StatusInternalServerError)
		}
		return model.NewAppError("EnablePlugin", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

// DisablePlugin will set the config for an installed plugin to disabled, triggering deactivation if active.
func (a *App) DisablePlugin(id string) *model.AppError {
	if a.PluginEnv == nil || !*a.Config().PluginSettings.Enable {
		return model.NewAppError("DisablePlugin", "app.plugin.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	plugins, err := a.PluginEnv.Plugins()
	if err != nil {
		return model.NewAppError("DisablePlugin", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	var manifest *model.Manifest
	for _, p := range plugins {
		if p.Manifest.Id == id {
			manifest = p.Manifest
			break
		}
	}

	if manifest == nil {
		return model.NewAppError("DisablePlugin", "app.plugin.not_installed.app_error", nil, "", http.StatusBadRequest)
	}

	if err := a.setPluginStatusState(manifest.Id, model.PluginStateStopping); err != nil {
		return model.NewAppError("EnablePlugin", "app.plugin.set_plugin_status_state.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	a.UpdateConfig(func(cfg *model.Config) {
		cfg.PluginSettings.PluginStates[id] = &model.PluginState{Enable: false}
	})

	if err := a.SaveConfig(a.Config(), true); err != nil {
		return model.NewAppError("DisablePlugin", "app.plugin.config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) InitPlugins(pluginPath, webappPath string, supervisorOverride pluginenv.SupervisorProviderFunc) {
	if a.PluginEnv != nil {
		return
	}

	if !*a.Config().PluginSettings.Enable {
		return
	}

	mlog.Info("Starting up plugins")

	a.pluginStatuses = make(map[string]*model.PluginStatus)

	if err := os.Mkdir(pluginPath, 0744); err != nil && !os.IsExist(err) {
		mlog.Error("Failed to start up plugins", mlog.Err(err))
		return
	}

	if err := os.Mkdir(webappPath, 0744); err != nil && !os.IsExist(err) {
		mlog.Error("Failed to start up plugins", mlog.Err(err))
		return
	}

	options := []pluginenv.Option{
		pluginenv.SearchPath(pluginPath),
		pluginenv.WebappPath(webappPath),
		pluginenv.APIProvider(func(m *model.Manifest) (plugin.API, error) {
			return &PluginAPI{
				id:  m.Id,
				app: a,
				keyValueStore: &PluginKeyValueStore{
					id:  m.Id,
					app: a,
				},
			}, nil
		}),
	}

	if err := sandbox.CheckSupport(); err != nil {
		a.IsPluginSandboxSupported = false
		mlog.Warn("plugin sandboxing is not supported. plugins will run with the same access level as the server. See documentation to learn more: https://developers.mattermost.com/extend/plugins/security/", mlog.Err(err))
	} else {
		a.IsPluginSandboxSupported = true
	}

	if supervisorOverride != nil {
		options = append(options, pluginenv.SupervisorProvider(supervisorOverride))
	} else if a.IsPluginSandboxSupported {
		options = append(options, pluginenv.SupervisorProvider(sandbox.SupervisorProvider))
	} else {
		options = append(options, pluginenv.SupervisorProvider(rpcplugin.SupervisorProvider))
	}

	if env, err := pluginenv.New(options...); err != nil {
		mlog.Error("Failed to start up plugins", mlog.Err(err))
		return
	} else {
		a.PluginEnv = env
	}

	for id, asset := range prepackagedPlugins {
		if tarball, err := asset("plugin.tar.gz"); err != nil {
			mlog.Error("Failed to install prepackaged plugin", mlog.Err(err))
		} else if tarball != nil {
			a.removePlugin(id, true)
			if _, err := a.installPlugin(bytes.NewReader(tarball), true); err != nil {
				mlog.Error("Failed to install prepackaged plugin", mlog.Err(err))
			}
			if _, ok := a.Config().PluginSettings.PluginStates[id]; !ok && id != "zoom" {
				if err := a.EnablePlugin(id); err != nil {
					mlog.Error("Failed to enable prepackaged plugin", mlog.Err(err))
				}
			}
		}
	}

	a.RemoveConfigListener(a.PluginConfigListenerId)
	a.PluginConfigListenerId = a.AddConfigListener(func(oldCfg *model.Config, cfg *model.Config) {
		if a.PluginEnv == nil {
			return
		}

		if *oldCfg.PluginSettings.Enable != *cfg.PluginSettings.Enable {
			a.setPluginsActive(*cfg.PluginSettings.Enable)
		} else {
			plugins := map[string]bool{}
			for id := range oldCfg.PluginSettings.PluginStates {
				plugins[id] = true
			}
			for id := range cfg.PluginSettings.PluginStates {
				plugins[id] = true
			}

			for id := range plugins {
				oldPluginState := oldCfg.PluginSettings.PluginStates[id]
				pluginState := cfg.PluginSettings.PluginStates[id]

				wasEnabled := oldPluginState != nil && oldPluginState.Enable
				isEnabled := pluginState != nil && pluginState.Enable

				if wasEnabled != isEnabled {
					a.setPluginActiveById(id, isEnabled)
				}
			}
		}

		for _, err := range a.PluginEnv.Hooks().OnConfigurationChange() {
			mlog.Error(err.Error())
		}
	})

	a.setPluginsActive(true)
}

func (a *App) ServePluginRequest(w http.ResponseWriter, r *http.Request) {
	if a.PluginEnv == nil || !*a.Config().PluginSettings.Enable {
		err := model.NewAppError("ServePluginRequest", "app.plugin.disabled.app_error", nil, "Enable plugins to serve plugin requests", http.StatusNotImplemented)
		mlog.Error(err.Error())
		w.WriteHeader(err.StatusCode)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(err.ToJson()))
		return
	}

	a.servePluginRequest(w, r, a.PluginEnv.Hooks().ServeHTTP)
}

func (a *App) servePluginRequest(w http.ResponseWriter, r *http.Request, handler http.HandlerFunc) {
	token := ""

	authHeader := r.Header.Get(model.HEADER_AUTH)
	if strings.HasPrefix(strings.ToUpper(authHeader), model.HEADER_BEARER+" ") {
		token = authHeader[len(model.HEADER_BEARER)+1:]
	} else if strings.HasPrefix(strings.ToLower(authHeader), model.HEADER_TOKEN+" ") {
		token = authHeader[len(model.HEADER_TOKEN)+1:]
	} else if cookie, _ := r.Cookie(model.SESSION_COOKIE_TOKEN); cookie != nil && (r.Method == "GET" || r.Header.Get(model.HEADER_REQUESTED_WITH) == model.HEADER_REQUESTED_WITH_XML) {
		token = cookie.Value
	} else {
		token = r.URL.Query().Get("access_token")
	}

	r.Header.Del("Mattermost-User-Id")
	if token != "" {
		if session, err := a.GetSession(token); session != nil && err == nil {
			r.Header.Set("Mattermost-User-Id", session.UserId)
		}
	}

	cookies := r.Cookies()
	r.Header.Del("Cookie")
	for _, c := range cookies {
		if c.Name != model.SESSION_COOKIE_TOKEN {
			r.AddCookie(c)
		}
	}
	r.Header.Del(model.HEADER_AUTH)
	r.Header.Del("Referer")

	params := mux.Vars(r)

	newQuery := r.URL.Query()
	newQuery.Del("access_token")
	r.URL.RawQuery = newQuery.Encode()
	r.URL.Path = strings.TrimPrefix(r.URL.Path, "/plugins/"+params["plugin_id"])

	handler(w, r.WithContext(context.WithValue(r.Context(), "plugin_id", params["plugin_id"])))
}

func (a *App) ShutDownPlugins() {
	if a.PluginEnv == nil {
		return
	}

	mlog.Info("Shutting down plugins")

	for _, err := range a.PluginEnv.Shutdown() {
		mlog.Error(err.Error())
	}
	a.RemoveConfigListener(a.PluginConfigListenerId)
	a.PluginConfigListenerId = ""
	a.PluginEnv = nil
}

func getKeyHash(key string) string {
	hash := sha256.New()
	hash.Write([]byte(key))
	return base64.StdEncoding.EncodeToString(hash.Sum(nil))
}

func (a *App) SetPluginKey(pluginId string, key string, value []byte) *model.AppError {
	kv := &model.PluginKeyValue{
		PluginId: pluginId,
		Key:      getKeyHash(key),
		Value:    value,
	}

	result := <-a.Srv.Store.Plugin().SaveOrUpdate(kv)

	if result.Err != nil {
		mlog.Error(result.Err.Error())
	}

	return result.Err
}

func (a *App) GetPluginKey(pluginId string, key string) ([]byte, *model.AppError) {
	result := <-a.Srv.Store.Plugin().Get(pluginId, getKeyHash(key))

	if result.Err != nil {
		if result.Err.StatusCode == http.StatusNotFound {
			return nil, nil
		}
		mlog.Error(result.Err.Error())
		return nil, result.Err
	}

	kv := result.Data.(*model.PluginKeyValue)

	return kv.Value, nil
}

func (a *App) DeletePluginKey(pluginId string, key string) *model.AppError {
	result := <-a.Srv.Store.Plugin().Delete(pluginId, getKeyHash(key))

	if result.Err != nil {
		mlog.Error(result.Err.Error())
	}

	return result.Err
}

type PluginCommand struct {
	Command  *model.Command
	PluginId string
}

func (a *App) RegisterPluginCommand(pluginId string, command *model.Command) error {
	if command.Trigger == "" {
		return fmt.Errorf("invalid command")
	}

	command = &model.Command{
		Trigger:          strings.ToLower(command.Trigger),
		TeamId:           command.TeamId,
		AutoComplete:     command.AutoComplete,
		AutoCompleteDesc: command.AutoCompleteDesc,
		AutoCompleteHint: command.AutoCompleteHint,
		DisplayName:      command.DisplayName,
	}

	a.pluginCommandsLock.Lock()
	defer a.pluginCommandsLock.Unlock()

	for _, pc := range a.pluginCommands {
		if pc.Command.Trigger == command.Trigger && pc.Command.TeamId == command.TeamId {
			if pc.PluginId == pluginId {
				pc.Command = command
				return nil
			}
		}
	}

	a.pluginCommands = append(a.pluginCommands, &PluginCommand{
		Command:  command,
		PluginId: pluginId,
	})
	return nil
}

func (a *App) UnregisterPluginCommand(pluginId, teamId, trigger string) {
	trigger = strings.ToLower(trigger)

	a.pluginCommandsLock.Lock()
	defer a.pluginCommandsLock.Unlock()

	var remaining []*PluginCommand
	for _, pc := range a.pluginCommands {
		if pc.Command.TeamId != teamId || pc.Command.Trigger != trigger {
			remaining = append(remaining, pc)
		}
	}
	a.pluginCommands = remaining
}

func (a *App) UnregisterPluginCommands(pluginId string) {
	a.pluginCommandsLock.Lock()
	defer a.pluginCommandsLock.Unlock()

	var remaining []*PluginCommand
	for _, pc := range a.pluginCommands {
		if pc.PluginId != pluginId {
			remaining = append(remaining, pc)
		}
	}
	a.pluginCommands = remaining
}

func (a *App) PluginCommandsForTeam(teamId string) []*model.Command {
	a.pluginCommandsLock.RLock()
	defer a.pluginCommandsLock.RUnlock()

	var commands []*model.Command
	for _, pc := range a.pluginCommands {
		if pc.Command.TeamId == "" || pc.Command.TeamId == teamId {
			commands = append(commands, pc.Command)
		}
	}
	return commands
}

func (a *App) ExecutePluginCommand(args *model.CommandArgs) (*model.Command, *model.CommandResponse, *model.AppError) {
	parts := strings.Split(args.Command, " ")
	trigger := parts[0][1:]
	trigger = strings.ToLower(trigger)

	a.pluginCommandsLock.RLock()
	defer a.pluginCommandsLock.RUnlock()

	for _, pc := range a.pluginCommands {
		if (pc.Command.TeamId == "" || pc.Command.TeamId == args.TeamId) && pc.Command.Trigger == trigger {
			response, appErr, err := a.PluginEnv.HooksForPlugin(pc.PluginId).ExecuteCommand(args)
			if err != nil {
				return pc.Command, nil, model.NewAppError("ExecutePluginCommand", "model.plugin_command.error.app_error", nil, "err="+err.Error(), http.StatusInternalServerError)
			}
			return pc.Command, response, appErr
		}
	}
	return nil, nil, nil
}

func (a *App) PluginsReady() bool {
	return a.PluginEnv != nil && *a.Config().PluginSettings.Enable
}
