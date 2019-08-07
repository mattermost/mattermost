// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"encoding/json"

	"github.com/mattermost/mattermost-server/model"
)

// KVGetJSON is a wrapper around KVGet to simplify reading a JSON object from the key value store.
func (p *HelpersImpl) KVGetJSON(key string, value interface{}) (bool, error) {
	data, appErr := p.API.KVGet(key)
	if appErr != nil {
		return false, appErr
	}
	if data == nil {
		return false, nil
	}

	err := json.Unmarshal(data, value)
	if err != nil {
		return false, err
	}

	return true, nil
}

// KVSetJSON is a wrapper around KVSet to simplify writing a JSON object to the key value store.
func (p *HelpersImpl) KVSetJSON(key string, value interface{}) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	return p.API.KVSet(key, data)
}

// KVCompareAndSetJSON is a wrapper around KVCompareAndSet to simplify atomically writing a JSON object to the key value store.
func (p *HelpersImpl) KVCompareAndSetJSON(key string, oldValue interface{}, newValue interface{}) (bool, error) {
	options := &model.PluginKVSetOptions{
		EncodeJSON: true,
		Atomic:     true,
		OldValue:   oldValue,
	}
	return p.API.KVSetWithOptions(key, newValue, options)
}

// KVSetWithExpiryJSON is a wrapper around KVSetWithExpiry to simplify atomically writing a JSON object with expiry to the key value store.
func (p *HelpersImpl) KVSetWithExpiryJSON(key string, value interface{}, expireInSeconds int64) error {
	options := &model.PluginKVSetOptions{
		EncodeJSON:      true,
		ExpiryInSeconds: expireInSeconds,
	}

	_, err := p.API.KVSetWithOptions(key, value, options)
	return err
}
