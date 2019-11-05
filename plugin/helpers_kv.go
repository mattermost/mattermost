// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"encoding/json"

	"github.com/pkg/errors"
)

// KVSetJSON implements Helpers.KVSetJSON.
func (p *HelpersImpl) KVSetJSON(key string, value interface{}) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	appErr := p.API.KVSet(key, data)
	if appErr != nil {
		return appErr
	}

	return nil
}

// KVCompareAndSetJSON implements Helpers.KVCompareAndSetJSON.
func (p *HelpersImpl) KVCompareAndSetJSON(key string, oldValue interface{}, newValue interface{}) (bool, error) {
	var oldData, newData []byte
	var err error

	if oldValue != nil {
		oldData, err = json.Marshal(oldValue)
		if err != nil {
			return false, errors.Wrap(err, "unable to marshal old value")
		}
	}

	if newValue != nil {
		newData, err = json.Marshal(newValue)
		if err != nil {
			return false, errors.Wrap(err, "unable to marshal new value")
		}
	}

	set, appErr := p.API.KVCompareAndSet(key, oldData, newData)
	if appErr != nil {
		return set, appErr
	}

	return set, nil
}

// KVCompareAndDeleteJSON implements Helpers.KVCompareAndDeleteJSON.
func (p *HelpersImpl) KVCompareAndDeleteJSON(key string, oldValue interface{}) (bool, error) {
	var oldData []byte
	var err error

	if oldValue != nil {
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
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	appErr := p.API.KVSetWithExpiry(key, data, expireInSeconds)
	if appErr != nil {
		return appErr
	}

	return nil
}
