package pluginenv

type Option func(*Environment) error

// APIProvider specifies a function that provides an API implementation to each plugin.
func APIProvider(provider APIProviderFunc) Option {
	return func(env *Environment) error {
		env.apiProvider = provider
		return nil
	}
}

// SupervisorProvider specifies a function that provides a Supervisor implementation to each plugin.
func SupervisorProvider(provider SupervisorProviderFunc) Option {
	return func(env *Environment) error {
		env.supervisorProvider = provider
		return nil
	}
}

// Path specifies a directory that contains the plugins to launch.
func SearchPath(path string) Option {
	return func(env *Environment) error {
		env.searchPath = path
		return nil
	}
}
