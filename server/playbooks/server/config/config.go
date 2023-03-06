package config

// Service is the config.Service interface.
// NOTE: for now we are defining this here for simplicity. It will be mocked by multiple consumers,
// so keep the definition in one place -- here. In the future we may move to a
// consumer-defines-the-interface style (and mocks it themselves), but since this is used
// internally, at this point the trade-off is not worth it.
type Service interface {
	// GetConfiguration retrieves the active configuration under lock, making it safe to use
	// concurrently. The active configuration may change underneath the client of this method, but
	// the struct returned by this API call is considered immutable.
	GetConfiguration() *Configuration

	// UpdateConfiguration updates the config. Any parts of the config that are persisted in the plugin's
	// section in the server's config will be saved to the server.
	UpdateConfiguration(f func(*Configuration)) error

	// RegisterConfigChangeListener registers a function that will called when the config might have
	// been changed. Returns an id which can be used to unregister the listener.
	RegisterConfigChangeListener(listener func()) string

	// UnregisterConfigChangeListener unregisters the listener function identified by id.
	UnregisterConfigChangeListener(id string)

	// IsConfiguredForDevelopmentAndTesting returns true when the server has `EnableDeveloper` and
	// `EnableTesting` configuration settings enabled.
	IsConfiguredForDevelopmentAndTesting() bool

	// IsCloud returns true when the server has a Cloud license.
	IsCloud() bool

	// SupportsGivingFeedback returns nil when the nps plugin is installed and enabled, thus enabling giving feedback.
	SupportsGivingFeedback() error
}
