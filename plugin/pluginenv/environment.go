// Package pluginenv provides high level functionality for discovering and launching plugins.
package pluginenv

import (
	"fmt"

	"github.com/pkg/errors"

	"github.com/mattermost/platform/plugin"
)

type APIProviderFunc func(*plugin.Manifest) (plugin.API, error)
type SupervisorProviderFunc func(*plugin.BundleInfo) (plugin.Supervisor, error)

// Environment represents an environment that plugins are discovered and launched in.
type Environment struct {
	searchPath         string
	apiProvider        APIProviderFunc
	supervisorProvider SupervisorProviderFunc
	activePlugins      map[string]plugin.Supervisor
}

type Option func(*Environment)

// Creates a new environment. At a minimum, the APIProvider and SearchPath options are required.
func New(options ...Option) (*Environment, error) {
	env := &Environment{
		activePlugins: make(map[string]plugin.Supervisor),
	}
	for _, opt := range options {
		opt(env)
	}
	if env.supervisorProvider == nil {
		env.supervisorProvider = DefaultSupervisorProvider
	}
	if env.searchPath == "" {
		return nil, fmt.Errorf("a search path must be provided")
	} else if env.apiProvider == nil {
		return nil, fmt.Errorf("an api provider must be provided")
	}
	return env, nil
}

// Returns a list of all plugins found within the environment.
func (env *Environment) Plugins() ([]*plugin.BundleInfo, error) {
	return ScanSearchPath(env.searchPath)
}

// Returns the ids of the currently active plugins.
func (env *Environment) ActivePluginIds() (ids []string) {
	for id := range env.activePlugins {
		ids = append(ids, id)
	}
	return
}

// Activates the plugin with the given id.
func (env *Environment) ActivatePlugin(id string) error {
	if _, ok := env.activePlugins[id]; ok {
		return fmt.Errorf("plugin already active: %v", id)
	}
	plugins, err := ScanSearchPath(env.searchPath)
	if err != nil {
		return err
	}
	var plugin *plugin.BundleInfo
	for _, p := range plugins {
		if p.Manifest != nil && p.Manifest.Id == id {
			if plugin != nil {
				return fmt.Errorf("multiple plugins found: %v", id)
			}
			plugin = p
		}
	}
	if plugin == nil {
		return fmt.Errorf("plugin not found: %v", id)
	}
	supervisor, err := env.supervisorProvider(plugin)
	if err != nil {
		return errors.Wrapf(err, "unable to create supervisor for plugin: %v", id)
	}
	api, err := env.apiProvider(plugin.Manifest)
	if err != nil {
		return errors.Wrapf(err, "unable to get api for plugin: %v", id)
	}
	if err := supervisor.Start(); err != nil {
		return errors.Wrapf(err, "unable to start plugin: %v", id)
	}
	if err := supervisor.Hooks().OnActivate(api); err != nil {
		supervisor.Stop()
		return errors.Wrapf(err, "unable to activate plugin: %v", id)
	}
	env.activePlugins[id] = supervisor
	return nil
}

// Deactivates the plugin with the given id.
func (env *Environment) DeactivatePlugin(id string) error {
	if supervisor, ok := env.activePlugins[id]; !ok {
		return fmt.Errorf("plugin not active: %v", id)
	} else {
		delete(env.activePlugins, id)
		err := supervisor.Hooks().OnDeactivate()
		if serr := supervisor.Stop(); err == nil {
			err = serr
		}
		return err
	}
}

// Deactivates all plugins and gracefully shuts down the environment.
func (env *Environment) Shutdown() (errs []error) {
	for _, supervisor := range env.activePlugins {
		if err := supervisor.Hooks().OnDeactivate(); err != nil {
			errs = append(errs, err)
		}
		if err := supervisor.Stop(); err != nil {
			errs = append(errs, err)
		}
	}
	env.activePlugins = make(map[string]plugin.Supervisor)
	return
}
