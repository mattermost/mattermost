// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import "github.com/mattermost/mattermost-server/model"

type Helpers interface {
	// EnsureBot ether returns an existing bot user or creates a bot user with
	// the specifications of the passed bot.
	// Returns the id of the bot created or existing.
	EnsureBot(bot *model.Bot) (string, error)

	// SetLocalization caches the localization settings and initializes the i18n system for
	// plugin, server-side translations. Normally called in OnConfigurationChange by the plugin.
	SetLocalization(settings *model.LocalizationSettings, i18nDirectory string) error

	// TContext Given a context and a translation id and optional arguments retrieves the translation
	// of the string appropriate for the given user. Must call SetLocalization before use.
	TContext(c *Context, translationID string, args ...interface{}) string

	// TServer is for situations where you don't have a context or don't want the message tailored to
	// a specific user. It will use the DefaultClientLocale. Must call SetLocalization before use.
	TServer(translationID string, args ...interface{}) string
}

type HelpersImpl struct {
	API API

	// Caches the server's localization settings
	localizationSettings *model.LocalizationSettings

	// Stores the available locales for translation
	locales map[string]string
}
