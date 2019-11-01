// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"encoding/json"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/model"
)

// KVSetJSON implements Helpers.KVSetJSON.
func (p *HelpersImpl) KVSetJSON(key string, value interface{}) error {
	options := model.PluginKVSetOptions{
		EncodeJSON: true,
	}

	if _, err := p.API.KVSetWithOptions(key, value, options); err != nil {
		return err
	}

	return nil
}

// KVSetJSON implements Helpers.KVCompareAndSetJSON.
func (p *HelpersImpl) KVCompareAndSetJSON(key string, oldValue interface{}, newValue interface{}) (bool, error) {
	options := model.PluginKVSetOptions{
		EncodeJSON: true,
		Atomic:     true,
		OldValue:   oldValue,
	}

	set, err := p.API.KVSetWithOptions(key, newValue, options)
	if err != nil {
		return false, err
	}

	return set, nil
}

// KVCompareAndDeleteJSON implements Helpers.KVCompareAndDeleteJSON.
func (p *HelpersImpl) KVCompareAndDeleteJSON(key string, oldValue interface{}) (bool, error) {
	var oldData []byte

	if oldValue != nil {
		var err error
		oldData, err = json.Marshal(oldValue)
		if err != nil {
			return false, errors.Wrap(err, "unable to marshal old value")
		}
	}

	deleted, appErr := p.API.KVCompareAndDelete(key, oldData)
	if appErr != nil {
		return deleted, appErr
	}

	return deleted, nil
}

// KVGetJSON implements Helpers.KVGetJSON.
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

// KVSetWithExpiryJSON implements Helpers.KVSetWithExpiryJSON.
func (p *HelpersImpl) KVSetWithExpiryJSON(key string, value interface{}, expireInSeconds int64) error {
	options := model.PluginKVSetOptions{
		EncodeJSON:      true,
		ExpireInSeconds: expireInSeconds,
	}

	if _, err := p.API.KVSetWithOptions(key, value, options); err != nil {
		return err
	}

	return nil
}
