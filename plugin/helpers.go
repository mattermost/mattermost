// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import "github.com/mattermost/mattermost-server/model"

type Helpers interface {
	// EnsureBot either returns an existing bot user or creates a bot user with
	// the specifications of the passed bot.
	// Returns the id of the bot created or existing.
	EnsureBot(bot *model.Bot) (string, error)

	// KVGetJSON retrievs a value based on the key.
	KVGetJSON(key string, value interface{}) error

	// KVSetJSON stores a key-value pair.
	KVSetJSON(key string, value interface{}) error

	// KVCompareAndSetJSON updates a key-value pair if the current
	// value is equal to oldValue.
	// Returns (false, err) if DB/marshal/unmarshal error occurred
	// Returns (false, nil) if current value != old value
	// Returns (true, nil) if current value == old value or new key is inserted
	KVCompareAndSetJSON(key string, oldValue interface{}, newValue interface{}) (bool, error)

	// KVSetWithExpiryJSON stores a key-value pair with an expiry time.
	KVSetWithExpiryJSON(key string, value interface{}, expireInSeconds int64) error
}

type HelpersImpl struct {
	API API
}
