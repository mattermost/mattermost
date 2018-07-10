// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"fmt"
	"io/ioutil"
	"path/filepath"
	"sync"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/pkg/errors"
)

type APIImplCreatorFunc func(*model.Manifest) API
type SupervisorCreatorFunc func(*model.BundleInfo, *mlog.Logger, API) (*Supervisor, error)

// Hooks will be the hooks API for the plugin
// Return value should be true if we should continue calling more plugins
type MultliPluginHookRunnerFunc func(hooks Hooks) bool

type ActivePlugin struct {
	BundleInfo *model.BundleInfo
	State      int
	Supervisor *Supervisor
}

type Environment struct {
	activePlugins   map[string]ActivePlugin
	mutex           sync.RWMutex
	logger          *mlog.Logger
	newAPIImpl      APIImplCreatorFunc
	pluginDir       string
	webappPluginDir string
}

func NewEnvironment(newAPIImpl APIImplCreatorFunc, pluginDir string, webappPluginDir string, logger *mlog.Logger) (*Environment, error) {
	return &Environment{
		activePlugins:   make(map[string]ActivePlugin),
		logger:          logger,
		newAPIImpl:      newAPIImpl,
		pluginDir:       pluginDir,
		webappPluginDir: webappPluginDir,
	}, nil
}

// Performs a full scan of the given path.
//
// This function will return info for all subdirectories that appear to be plugins (i.e. all
// subdirectories containing plugin manifest files, regardless of whether they could actually be
// parsed).
//
// Plugins are found non-recursively and paths beginning with a dot are always ignored.
func ScanSearchPath(path string) ([]*model.BundleInfo, error) {
	files, err := ioutil.ReadDir(path)
	if err != nil {
		return nil, err
	}
	var ret []*model.BundleInfo
	for _, file := range files {
		if !file.IsDir() || file.Name()[0] == '.' {
			continue
		}
		if info := model.BundleInfoForPath(filepath.Join(path, file.Name())); info.ManifestPath != "" {
			ret = append(ret, info)
		}
	}
	return ret, nil
}

// Returns a list of all plugins within the environment.
func (env *Environment) Available() ([]*model.BundleInfo, error) {
	return ScanSearchPath(env.pluginDir)
}

// Returns a list of all currently active plugins within the environment.
func (env *Environment) Active() []*model.BundleInfo {
	env.mutex.RLock()
	defer env.mutex.RUnlock()

	activePlugins := []*model.BundleInfo{}
	for _, p := range env.activePlugins {
		activePlugins = append(activePlugins, p.BundleInfo)
	}

	return activePlugins
}

func (env *Environment) IsActive(id string) bool {
	_, ok := env.activePlugins[id]
	return ok
}

// Returns a list of plugin statuses reprensenting the state of every plugin
func (env *Environment) Statuses() (model.PluginStatuses, error) {
	env.mutex.RLock()
	defer env.mutex.RUnlock()

	plugins, err := env.Available()
	if err != nil {
		return nil, errors.Wrap(err, "unable to get plugin statuses")
	}

	pluginStatuses := make(model.PluginStatuses, 0, len(plugins))
	for _, plugin := range plugins {
		// For now we don't handle bad manifests, we should
		if plugin.Manifest == nil {
			continue
		}

		pluginState := model.PluginStateNotRunning
		if plugin, ok := env.activePlugins[plugin.Manifest.Id]; ok {
			pluginState = plugin.State
		}

		status := &model.PluginStatus{
			PluginId:    plugin.Manifest.Id,
			PluginPath:  filepath.Dir(plugin.ManifestPath),
			State:       pluginState,
			Name:        plugin.Manifest.Name,
			Description: plugin.Manifest.Description,
			Version:     plugin.Manifest.Version,
		}

		pluginStatuses = append(pluginStatuses, status)
	}

	return pluginStatuses, nil
}

func (env *Environment) Activate(id string) (reterr error) {
	env.mutex.Lock()
	defer env.mutex.Unlock()

	// Check if we are already active
	if _, ok := env.activePlugins[id]; ok {
		return nil
	}

	plugins, err := env.Available()
	if err != nil {
		return err
	}
	var pluginInfo *model.BundleInfo
	for _, p := range plugins {
		if p.Manifest != nil && p.Manifest.Id == id {
			if pluginInfo != nil {
				return fmt.Errorf("multiple plugins found: %v", id)
			}
			pluginInfo = p
		}
	}
	if pluginInfo == nil {
		return fmt.Errorf("plugin not found: %v", id)
	}

	activePlugin := ActivePlugin{BundleInfo: pluginInfo}
	defer func() {
		if reterr == nil {
			activePlugin.State = model.PluginStateRunning
		} else {
			activePlugin.State = model.PluginStateFailedToStart
		}
		env.activePlugins[pluginInfo.Manifest.Id] = activePlugin
	}()

	if pluginInfo.Manifest.Webapp != nil {
		bundlePath := filepath.Clean(pluginInfo.Manifest.Webapp.BundlePath)
		if bundlePath == "" || bundlePath[0] == '.' {
			return fmt.Errorf("invalid webapp bundle path")
		}
		bundlePath = filepath.Join(env.pluginDir, id, bundlePath)

		webappBundle, err := ioutil.ReadFile(bundlePath)
		if err != nil {
			return errors.Wrapf(err, "unable to read webapp bundle: %v", id)
		}

		err = ioutil.WriteFile(fmt.Sprintf("%s/%s_bundle.js", env.webappPluginDir, id), webappBundle, 0644)
		if err != nil {
			return errors.Wrapf(err, "unable to write webapp bundle: %v", id)
		}
	}

	if pluginInfo.Manifest.Backend != nil {
		supervisor, err := NewSupervisor(pluginInfo, env.logger, env.newAPIImpl(pluginInfo.Manifest))
		if err != nil {
			return errors.Wrapf(err, "unable to start plugin: %v", id)
		}
		activePlugin.Supervisor = supervisor
	}

	return nil
}

// Deactivates the plugin with the given id.
func (env *Environment) Deactivate(id string) {
	env.mutex.Lock()
	defer env.mutex.Unlock()

	if activePlugin, ok := env.activePlugins[id]; !ok {
		return
	} else {
		delete(env.activePlugins, id)
		if activePlugin.Supervisor != nil {
			if err := activePlugin.Supervisor.Hooks().OnDeactivate(); err != nil {
				env.logger.Error("Plugin OnDeactivate() error", mlog.String("plugin_id", activePlugin.BundleInfo.Manifest.Id), mlog.Err(err))
			}
			activePlugin.Supervisor.Shutdown()
		}
	}
}

// Deactivates all plugins and gracefully shuts down the environment.
func (env *Environment) Shutdown() {
	env.mutex.Lock()
	defer env.mutex.Unlock()

	for _, activePlugin := range env.activePlugins {
		if activePlugin.Supervisor != nil {
			if err := activePlugin.Supervisor.Hooks().OnDeactivate(); err != nil {
				env.logger.Error("Plugin OnDeactivate() error", mlog.String("plugin_id", activePlugin.BundleInfo.Manifest.Id), mlog.Err(err))
			}
			activePlugin.Supervisor.Shutdown()
		}
	}
	env.activePlugins = make(map[string]ActivePlugin)
	return
}

// Returns the hooks API for the plugin ID specified
// You should probably use RunMultiPluginHook instead.
func (env *Environment) HooksForPlugin(id string) (Hooks, error) {
	env.mutex.RLock()
	defer env.mutex.RUnlock()

	if plug, ok := env.activePlugins[id]; ok && plug.Supervisor != nil {
		return plug.Supervisor.Hooks(), nil
	}

	return nil, fmt.Errorf("plugin not found: %v", id)
}

// Calls hookRunnerFunc with the hooks for each active plugin that implments the given HookId
// If hookRunnerFunc returns false, then iteration will not continue.
func (env *Environment) RunMultiPluginHook(hookRunnerFunc MultliPluginHookRunnerFunc, mustImplement int) {
	env.mutex.RLock()
	defer env.mutex.RUnlock()

	for _, activePlugin := range env.activePlugins {
		if activePlugin.Supervisor == nil || !activePlugin.Supervisor.Implements(mustImplement) {
			continue
		}
		if !hookRunnerFunc(activePlugin.Supervisor.Hooks()) {
			break
		}
	}
}
