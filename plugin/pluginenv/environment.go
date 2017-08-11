package pluginenv

import (
	"fmt"

	"github.com/pkg/errors"

	"github.com/mattermost/platform/plugin"
)

type APIProviderFunc func(*Manifest) (plugin.API, error)
type SupervisorProviderFunc func(*BundleInfo) (Supervisor, error)

// Environment represents an environment that plugins are discovered and launched in.
type Environment struct {
	searchPath         string
	apiProvider        APIProviderFunc
	supervisorProvider SupervisorProviderFunc
	activePlugins      map[string]Supervisor
}

// Creates a new environment.
func New(options ...Option) (*Environment, error) {
	env := &Environment{
		activePlugins: make(map[string]Supervisor),
	}
	for _, opt := range options {
		if err := opt(env); err != nil {
			return nil, err
		}
	}
	if env.searchPath == "" {
		return nil, fmt.Errorf("a search path must be provided")
	} else if env.apiProvider == nil {
		return nil, fmt.Errorf("an api provider must be provided")
	} else if env.supervisorProvider == nil {
		return nil, fmt.Errorf("a supervisor provider must be provided")
	}
	return env, nil
}

// Returns a list of all plugins found within the environment.
func (env *Environment) Plugins() ([]*BundleInfo, error) {
	return ScanSearchPath(env.searchPath)
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
	var plugin *BundleInfo
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
	supervisor.Dispatcher().OnActivate(api)
	env.activePlugins[id] = supervisor
	return nil
}

// Deactivates the plugin with the given id.
func (env *Environment) DeactivatePlugin(id string) error {
	if supervisor, ok := env.activePlugins[id]; !ok {
		return fmt.Errorf("plugin not active: %v", id)
	} else {
		delete(env.activePlugins, id)
		supervisor.Dispatcher().OnDeactivate()
		return supervisor.Stop()
	}
}

// Deactivates all plugins and gracefully shuts down the environment.
func (env *Environment) Shutdown() (errs []error) {
	for _, supervisor := range env.activePlugins {
		if err := supervisor.Stop(); err != nil {
			errs = append(errs, err)
		}
	}
	env.activePlugins = make(map[string]Supervisor)
	return
}
