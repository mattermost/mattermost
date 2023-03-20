// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

// Service is the config.Service interface.
// NOTE: for now we are defining this here for simplicity. It will be mocked by multiple consumers,
// so keep the definition in one place -- here. In the future we may move to a
// consumer-defines-the-interface style (and mocks it themselves), but since this is used
// internally, at this point the trade-off is not worth it.
type Service interface {
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
