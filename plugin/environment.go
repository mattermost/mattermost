// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"fmt"
	"hash/fnv"
	"io/ioutil"
	"os"
	"path/filepath"
	"sync"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/pkg/errors"
)

type apiImplCreatorFunc func(*model.Manifest) API

// multiPluginHookRunnerFunc is a callback function to invoke as part of RunMultiPluginHook.
//
// Return false to stop the hook from iterating to subsequent plugins.
type multiPluginHookRunnerFunc func(hooks Hooks) bool

type activePlugin struct {
	BundleInfo *model.BundleInfo
	State      int

	supervisor *supervisor
}

// Environment represents the execution environment of active plugins.
//
// It is meant for use by the Mattermost server to manipulate, interact with and report on the set
// of active plugins.
type Environment struct {
	activePlugins   sync.Map
	logger          *mlog.Logger
	newAPIImpl      apiImplCreatorFunc
	pluginDir       string
	webappPluginDir string
}

func NewEnvironment(newAPIImpl apiImplCreatorFunc, pluginDir string, webappPluginDir string, logger *mlog.Logger) (*Environment, error) {
	return &Environment{
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
func scanSearchPath(path string) ([]*model.BundleInfo, error) {
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
	return scanSearchPath(env.pluginDir)
}

// Returns a list of all currently active plugins within the environment.
func (env *Environment) Active() []*model.BundleInfo {
	activePlugins := []*model.BundleInfo{}
	env.activePlugins.Range(func(key, value interface{}) bool {
		activePlugins = append(activePlugins, value.(activePlugin).BundleInfo)

		return true
	})

	return activePlugins
}

// IsActive returns true if the plugin with the given id is active.
func (env *Environment) IsActive(id string) bool {
	_, ok := env.activePlugins.Load(id)
	return ok
}

// Statuses returns a list of plugin statuses representing the state of every plugin
func (env *Environment) Statuses() (model.PluginStatuses, error) {
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
		if plugin, ok := env.activePlugins.Load(plugin.Manifest.Id); ok {
			pluginState = plugin.(activePlugin).State
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

func (env *Environment) Activate(id string) (manifest *model.Manifest, activated bool, reterr error) {
	// Check if we are already active
	if _, ok := env.activePlugins.Load(id); ok {
		return nil, false, nil
	}

	plugins, err := env.Available()
	if err != nil {
		return nil, false, err
	}
	var pluginInfo *model.BundleInfo
	for _, p := range plugins {
		if p.Manifest != nil && p.Manifest.Id == id {
			if pluginInfo != nil {
				return nil, false, fmt.Errorf("multiple plugins found: %v", id)
			}
			pluginInfo = p
		}
	}
	if pluginInfo == nil {
		return nil, false, fmt.Errorf("plugin not found: %v", id)
	}

	activePlugin := activePlugin{BundleInfo: pluginInfo}
	defer func() {
		if reterr == nil {
			activePlugin.State = model.PluginStateRunning
		} else {
			activePlugin.State = model.PluginStateFailedToStart
		}
		env.activePlugins.Store(pluginInfo.Manifest.Id, activePlugin)
	}()

	componentActivated := false

	if pluginInfo.Manifest.HasWebapp() {
		bundlePath := filepath.Clean(pluginInfo.Manifest.Webapp.BundlePath)
		if bundlePath == "" || bundlePath[0] == '.' {
			return nil, false, fmt.Errorf("invalid webapp bundle path")
		}
		bundlePath = filepath.Join(env.pluginDir, id, bundlePath)
		destinationPath := filepath.Join(env.webappPluginDir, id)

		if err := os.RemoveAll(destinationPath); err != nil {
			return nil, false, errors.Wrapf(err, "unable to remove old webapp bundle directory: %v", destinationPath)
		}

		if err := utils.CopyDir(filepath.Dir(bundlePath), destinationPath); err != nil {
			return nil, false, errors.Wrapf(err, "unable to copy webapp bundle directory: %v", id)
		}

		sourceBundleFilepath := filepath.Join(destinationPath, filepath.Base(bundlePath))

		sourceBundleFileContents, err := ioutil.ReadFile(sourceBundleFilepath)
		if err != nil {
			return nil, false, errors.Wrapf(err, "unable to read webapp bundle: %v", id)
		}

		hash := fnv.New64a()
		hash.Write(sourceBundleFileContents)
		pluginInfo.Manifest.Webapp.BundleHash = hash.Sum([]byte{})

		if err := os.Rename(
			sourceBundleFilepath,
			filepath.Join(destinationPath, fmt.Sprintf("%s_%x_bundle.js", id, pluginInfo.Manifest.Webapp.BundleHash)),
		); err != nil {
			return nil, false, errors.Wrapf(err, "unable to rename webapp bundle: %v", id)
		}

		componentActivated = true
	}

	if pluginInfo.Manifest.HasServer() {
		supervisor, err := newSupervisor(pluginInfo, env.logger, env.newAPIImpl(pluginInfo.Manifest))
		if err != nil {
			return nil, false, errors.Wrapf(err, "unable to start plugin: %v", id)
		}
		activePlugin.supervisor = supervisor

		componentActivated = true
	}

	if !componentActivated {
		return nil, false, fmt.Errorf("unable to start plugin: must at least have a web app or server component")
	}

	return pluginInfo.Manifest, true, nil
}

// Deactivates the plugin with the given id.
func (env *Environment) Deactivate(id string) bool {
	p, ok := env.activePlugins.Load(id)
	if !ok {
		return false
	}

	env.activePlugins.Delete(id)

	activePlugin := p.(activePlugin)
	if activePlugin.supervisor != nil {
		if err := activePlugin.supervisor.Hooks().OnDeactivate(); err != nil {
			env.logger.Error("Plugin OnDeactivate() error", mlog.String("plugin_id", activePlugin.BundleInfo.Manifest.Id), mlog.Err(err))
		}
		activePlugin.supervisor.Shutdown()
	}

	return true
}

// Shutdown deactivates all plugins and gracefully shuts down the environment.
func (env *Environment) Shutdown() {
	env.activePlugins.Range(func(key, value interface{}) bool {
		activePlugin := value.(activePlugin)

		if activePlugin.supervisor != nil {
			if err := activePlugin.supervisor.Hooks().OnDeactivate(); err != nil {
				env.logger.Error("Plugin OnDeactivate() error", mlog.String("plugin_id", activePlugin.BundleInfo.Manifest.Id), mlog.Err(err))
			}
			activePlugin.supervisor.Shutdown()
		}

		env.activePlugins.Delete(key)

		return true
	})
}

// HooksForPlugin returns the hooks API for the plugin with the given id.
//
// Consider using RunMultiPluginHook instead.
func (env *Environment) HooksForPlugin(id string) (Hooks, error) {
	if p, ok := env.activePlugins.Load(id); ok {
		activePlugin := p.(activePlugin)
		if activePlugin.supervisor != nil {
			return activePlugin.supervisor.Hooks(), nil
		}
	}

	return nil, fmt.Errorf("plugin not found: %v", id)
}

// RunMultiPluginHook invokes hookRunnerFunc for each plugin that implements the given hookId.
//
// If hookRunnerFunc returns false, iteration will not continue. The iteration order among active
// plugins is not specified.
func (env *Environment) RunMultiPluginHook(hookRunnerFunc multiPluginHookRunnerFunc, hookId int) {
	env.activePlugins.Range(func(key, value interface{}) bool {
		activePlugin := value.(activePlugin)

		if activePlugin.supervisor == nil || !activePlugin.supervisor.Implements(hookId) {
			return true
		}
		if !hookRunnerFunc(activePlugin.supervisor.Hooks()) {
			return false
		}

		return true
	})
}
