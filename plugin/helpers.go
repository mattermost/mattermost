// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import "github.com/mattermost/mattermost-server/model"

type Helpers interface {
	// EnsureBot ether returns an existing bot user or creates a bot user with
	// the specifications of the passed bot.
	// Returns the id of the bot created or existing.
	EnsureBot(bot *model.Bot) (string, error)

	// KVGetJSON retrievs a value based on the key.
	KVGetJSON(key string, value interface{}) error

	// KVSetJSON stores a key-value pair
	KVSetJSON(key string, value interface{}) error

	// VKCompareAndSetJSON updates a key-value pair if the current
	// value is equal to oldValue. Inserts a key-value pair if oldValue is nil.
	// Will not update it the current value != oldValue.
	KVCompareAndSetJSON(key string, oldValue interface{}, newValue interface{}) error

	// KVSetWithExpiryJSON stores a key-value pair with an expiry time.
	KVSetWithExpiryJSON(key string, value interface{}, expireInSeconds int64) error
}

type HelpersImpl struct {
	API API
}
