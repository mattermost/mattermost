// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

// Helpers provide a common patterns plugins use.
//
// Plugins obtain access to the Helpers by embedding MattermostPlugin.
type Helpers interface {
	// EnsureBot either returns an existing bot user matching the given bot, or creates a bot user from the given bot.
	// A profile image or icon image may be optionally passed in to be set for the existing or newly created bot.
	// Returns the id of the resulting bot.
	//
	// Minimum server version: 5.10
	EnsureBot(bot *model.Bot, options ...EnsureBotOption) (string, error)

	// KVSetJSON stores a key-value pair, unique per plugin, marshalling the given value as a JSON string.
	//
	// Deprecated: Use p.API.KVSetWithOptions instead.
	//
	// Minimum server version: 5.2
	KVSetJSON(key string, value interface{}) error

	// KVCompareAndSetJSON updates a key-value pair, unique per plugin, but only if the current value matches the given oldValue after marshalling as a JSON string.
	// Inserts a new key if oldValue == nil.
	// Returns (false, err) if DB error occurred
	// Returns (false, nil) if current value != oldValue or key already exists when inserting
	// Returns (true, nil) if current value == oldValue or new key is inserted
	//
	// Deprecated: Use p.API.KVSetWithOptions instead.
	//
	// Minimum server version: 5.12
	KVCompareAndSetJSON(key string, oldValue interface{}, newValue interface{}) (bool, error)

	// KVCompareAndDeleteJSON deletes a key-value pair, unique per plugin, but only if the current value matches the given oldValue after marshalling as a JSON string.
	// Returns (false, err) if DB error occurred
	// Returns (false, nil) if current value != oldValue or the key was already deleted
	// Returns (true, nil) if current value == oldValue
	//
	// Minimum server version: 5.16
	KVCompareAndDeleteJSON(key string, oldValue interface{}) (bool, error)

	// KVGetJSON retrieves a value based on the key, unique per plugin, unmarshalling the previously set JSON string into the given value. Returns true if the key exists.
	//
	// Minimum server version: 5.2
	KVGetJSON(key string, value interface{}) (bool, error)

	// KVSetWithExpiryJSON stores a key-value pair with an expiry time, unique per plugin, marshalling the given value as a JSON string.
	//
	// Deprecated: Use p.API.KVSetWithOptions instead.
	//
	// Minimum server version: 5.6
	KVSetWithExpiryJSON(key string, value interface{}, expireInSeconds int64) error

	// CheckRequiredServerConfiguration checks if the server is configured according to
	// plugin requirements.
	//
	// Minimum server version: 5.2
	CheckRequiredServerConfiguration(req *model.Config) (bool, error)

	// ShouldProcessMessage returns if the message should be processed by a message hook.
	//
	// Use this method to avoid processing unnecessary messages in a MessageHasBeenPosted
	// or MessageWillBePosted hook, and indeed in some cases avoid an infinite loop between
	// two automated bots or plugins.
	//
	// The behaviour is customizable using the given options, since plugin needs may vary.
	// By default, system messages and messages from bots will be skipped.
	//
	// Minimum server version: 5.2
	ShouldProcessMessage(post *model.Post, options ...ShouldProcessMessageOption) (bool, error)

	// InstallPluginFromURL installs the plugin from the provided url.
	//
	// Minimum server version: 5.18
	InstallPluginFromURL(downloadURL string, replace bool) (*model.Manifest, error)
}

// HelpersImpl implements the helpers interface with an API that retrieves data on behalf of the plugin.
type HelpersImpl struct {
	API API
}
