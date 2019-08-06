// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import "github.com/mattermost/mattermost-server/model"

type Helpers interface {
	// EnsureBot either returns an existing bot user matching the given bot, or creates a bot user from the given bot.
	// Returns the id of the resulting bot.
	EnsureBot(bot *model.Bot) (string, error)

	// KVSetJSON stores a key-value pair, unique per plugin, marshalling the given value as a JSON string.
	KVSetJSON(key string, value interface{}) error

	// KVCompareAndSetJSON updates a key-value pair, unique per plugin, but only if the current value matches the given oldValue after marshalling as a JSON string.
	// Inserts a new key if oldValue == nil.
	// Returns (false, err) if DB error occurred
	// Returns (false, nil) if current value != oldValue or key already exists when inserting
	// Returns (true, nil) if current value == oldValue or new key is inserted
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
	KVGetJSON(key string, value interface{}) (bool, error)

	// KVSetWithExpiryJSON stores a key-value pair with an expiry time, unique per plugin, marshalling the given value as a JSON string.
	//
	// Minimum server version: 5.6
	KVSetWithExpiryJSON(key string, value interface{}, expireInSeconds int64) error
}

type HelpersImpl struct {
	API API
}
