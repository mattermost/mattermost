// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// Package pluginenv provides high level functionality for discovering and launching plugins.
package pluginenv

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"sync"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
)

type APIProviderFunc func(*model.Manifest) (plugin.API, error)
type SupervisorProviderFunc func(*model.BundleInfo) (plugin.Supervisor, error)

type ActivePlugin struct {
	BundleInfo *model.BundleInfo
	Supervisor plugin.Supervisor
}

// Environment represents an environment that plugins are discovered and launched in.
type Environment struct {
	searchPath         string
	webappPath         string
	apiProvider        APIProviderFunc
	supervisorProvider SupervisorProviderFunc
	activePlugins      map[string]ActivePlugin
	mutex              sync.RWMutex
}

type Option func(*Environment)

// Creates a new environment. At a minimum, the APIProvider and SearchPath options are required.
func New(options ...Option) (*Environment, error) {
	env := &Environment{
		activePlugins: make(map[string]ActivePlugin),
	}
	for _, opt := range options {
		opt(env)
	}
	if env.supervisorProvider == nil {
		env.supervisorProvider = DefaultSupervisorProvider
	}
	if env.searchPath == "" {
		return nil, fmt.Errorf("a search path must be provided")
	}
	return env, nil
}

// Returns the configured webapp path.
func (env *Environment) WebappPath() string {
	return env.webappPath
}

// Returns the configured search path.
func (env *Environment) SearchPath() string {
	return env.searchPath
}

// Returns a list of all plugins found within the environment.
func (env *Environment) Plugins() ([]*model.BundleInfo, error) {
	return ScanSearchPath(env.searchPath)
}

// Returns a list of all currently active plugins within the environment.
func (env *Environment) ActivePlugins() []*model.BundleInfo {
	env.mutex.RLock()
	defer env.mutex.RUnlock()

	activePlugins := []*model.BundleInfo{}
	for _, p := range env.activePlugins {
		activePlugins = append(activePlugins, p.BundleInfo)
	}

	return activePlugins
}

// Returns the ids of the currently active plugins.
func (env *Environment) ActivePluginIds() (ids []string) {
	env.mutex.RLock()
	defer env.mutex.RUnlock()

	for id := range env.activePlugins {
		ids = append(ids, id)
	}
	return
}

// Returns true if the plugin is active, false otherwise.
func (env *Environment) IsPluginActive(pluginId string) bool {
	env.mutex.RLock()
	defer env.mutex.RUnlock()

	for id := range env.activePlugins {
		if id == pluginId {
			return true
		}
	}

	return false
}

// Activates the plugin with the given id.
func (env *Environment) ActivatePlugin(id string) error {
	env.mutex.Lock()
	defer env.mutex.Unlock()

	if _, ok := env.activePlugins[id]; ok {
		return fmt.Errorf("plugin already active: %v", id)
	}
	plugins, err := ScanSearchPath(env.searchPath)
	if err != nil {
		return err
	}
	var bundle *model.BundleInfo
	for _, p := range plugins {
		if p.Manifest != nil && p.Manifest.Id == id {
			if bundle != nil {
				return fmt.Errorf("multiple plugins found: %v", id)
			}
			bundle = p
		}
	}
	if bundle == nil {
		return fmt.Errorf("plugin not found: %v", id)
	}

	activePlugin := ActivePlugin{BundleInfo: bundle}

	var supervisor plugin.Supervisor

	if bundle.Manifest.Backend != nil {
		if env.apiProvider == nil {
			return fmt.Errorf("env missing api provider, cannot activate plugin: %v", id)
		}

		supervisor, err = env.supervisorProvider(bundle)
		if err != nil {
			return errors.Wrapf(err, "unable to create supervisor for plugin: %v", id)
		}
		api, err := env.apiProvider(bundle.Manifest)
		if err != nil {
			return errors.Wrapf(err, "unable to get api for plugin: %v", id)
		}
		if err := supervisor.Start(api); err != nil {
			return errors.Wrapf(err, "unable to start plugin: %v", id)
		}

		activePlugin.Supervisor = supervisor
	}

	if bundle.Manifest.Webapp != nil {
		if env.webappPath == "" {
			if supervisor != nil {
				supervisor.Stop()
			}
			return fmt.Errorf("env missing webapp path, cannot activate plugin: %v", id)
		}

		webappBundle, err := ioutil.ReadFile(fmt.Sprintf("%s/%s/webapp/%s_bundle.js", env.searchPath, id, id))
		if err != nil {
			if supervisor != nil {
				supervisor.Stop()
			}
			return errors.Wrapf(err, "unable to read webapp bundle: %v", id)
		}

		err = ioutil.WriteFile(fmt.Sprintf("%s/%s_bundle.js", env.webappPath, id), webappBundle, 0644)
		if err != nil {
			if supervisor != nil {
				supervisor.Stop()
			}
			return errors.Wrapf(err, "unable to write webapp bundle: %v", id)
		}
	}

	env.activePlugins[id] = activePlugin
	return nil
}

// Deactivates the plugin with the given id.
func (env *Environment) DeactivatePlugin(id string) error {
	env.mutex.Lock()
	defer env.mutex.Unlock()

	if activePlugin, ok := env.activePlugins[id]; !ok {
		return fmt.Errorf("plugin not active: %v", id)
	} else {
		delete(env.activePlugins, id)
		var err error
		if activePlugin.Supervisor != nil {
			err = activePlugin.Supervisor.Hooks().OnDeactivate()
			if serr := activePlugin.Supervisor.Stop(); err == nil {
				err = serr
			}
		}
		return err
	}
}

// Deactivates all plugins and gracefully shuts down the environment.
func (env *Environment) Shutdown() (errs []error) {
	env.mutex.Lock()
	defer env.mutex.Unlock()

	for _, activePlugin := range env.activePlugins {
		if activePlugin.Supervisor != nil {
			if err := activePlugin.Supervisor.Hooks().OnDeactivate(); err != nil {
				errs = append(errs, errors.Wrapf(err, "OnDeactivate() error for %v", activePlugin.BundleInfo.Manifest.Id))
			}
			if err := activePlugin.Supervisor.Stop(); err != nil {
				errs = append(errs, errors.Wrapf(err, "error stopping supervisor for %v", activePlugin.BundleInfo.Manifest.Id))
			}
		}
	}
	env.activePlugins = make(map[string]ActivePlugin)
	return
}

type MultiPluginHooks struct {
	env *Environment
}

type SinglePluginHooks struct {
	env      *Environment
	pluginId string
}

func (env *Environment) Hooks() *MultiPluginHooks {
	return &MultiPluginHooks{
		env: env,
	}
}

func (env *Environment) HooksForPlugin(id string) *SinglePluginHooks {
	return &SinglePluginHooks{
		env:      env,
		pluginId: id,
	}
}

func (h *MultiPluginHooks) invoke(f func(plugin.Hooks) error) (errs []error) {
	h.env.mutex.RLock()
	defer h.env.mutex.RUnlock()

	for _, activePlugin := range h.env.activePlugins {
		if activePlugin.Supervisor == nil {
			continue
		}
		if err := f(activePlugin.Supervisor.Hooks()); err != nil {
			errs = append(errs, errors.Wrapf(err, "hook error for %v", activePlugin.BundleInfo.Manifest.Id))
		}
	}
	return
}

// OnConfigurationChange invokes the OnConfigurationChange hook for all plugins. Any errors
// encountered will be returned.
func (h *MultiPluginHooks) OnConfigurationChange() []error {
	return h.invoke(func(hooks plugin.Hooks) error {
		if err := hooks.OnConfigurationChange(); err != nil {
			return errors.Wrapf(err, "error calling OnConfigurationChange hook")
		}
		return nil
	})
}

// ServeHTTP invokes the ServeHTTP hook for the plugin identified by the request or responds with a
// 404 not found.
//
// It expects the request's context to have a plugin_id set.
func (h *MultiPluginHooks) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if id := r.Context().Value("plugin_id"); id != nil {
		if idstr, ok := id.(string); ok {
			h.env.mutex.RLock()
			defer h.env.mutex.RUnlock()
			if plugin, ok := h.env.activePlugins[idstr]; ok && plugin.Supervisor != nil {
				plugin.Supervisor.Hooks().ServeHTTP(w, r)
				return
			}
		}
	}
	http.NotFound(w, r)
}

func (h *SinglePluginHooks) invoke(f func(plugin.Hooks) error) error {
	h.env.mutex.RLock()
	defer h.env.mutex.RUnlock()

	if activePlugin, ok := h.env.activePlugins[h.pluginId]; ok && activePlugin.Supervisor != nil {
		if err := f(activePlugin.Supervisor.Hooks()); err != nil {
			return errors.Wrapf(err, "hook error for plugin: %v", activePlugin.BundleInfo.Manifest.Id)
		}
		return nil
	}
	return fmt.Errorf("unable to invoke hook for plugin: %v", h.pluginId)
}

// ExecuteCommand invokes the ExecuteCommand hook for the plugin.
func (h *SinglePluginHooks) ExecuteCommand(args *model.CommandArgs) (resp *model.CommandResponse, appErr *model.AppError, err error) {
	err = h.invoke(func(hooks plugin.Hooks) error {
		resp, appErr = hooks.ExecuteCommand(args)
		return nil
	})
	return
}
