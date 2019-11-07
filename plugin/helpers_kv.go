// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"context"
	"encoding/json"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/einterfaces"
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

// KVAtomicModify is a wrapper around KVGet and KVCompareAndSet that atomically modify data from the KV storage. This function
// takes the following parameters:
// . ctx 	A instance of context that should be use for cancellation.
// . key	String for querying the storage.
// . bucket	An instance of the TokenBucket interface that is use for throttling control on retries.
// . fn 	A function the modifies the initial data.
func (p *HelpersImpl) KVAtomicModify(ctx context.Context, key string, bucket einterfaces.TokenBucket, fn func(initialValue []byte) ([]byte, error)) error {
	var initialBytes, modifiedBytes []byte
	var err error
	for {
		select {
		case <-ctx.Done():
			return errors.Wrap(ctx.Err(), "modification error")
		default:
			err = bucket.Take()
			if err != nil {
				return errors.Wrap(err, "modification error")
			}
		}

		initialBytes, err = p.kvGetWithContext(ctx, key)
		if err != nil {
			return errors.Wrap(err, "modification error")
		}
		modifiedBytes, err = fn(initialBytes)
		if err != nil {
			return errors.Wrap(err, "modification error")
		}

		success, err := p.kvCompareAndSetWithContext(ctx, key, initialBytes, modifiedBytes)
		if err != nil {
			return err
		}
		if success {
			break
		}
	}
	return nil
}

func (p *HelpersImpl) kvGetWithContext(ctx context.Context, key string) ([]byte, error) {
	select {
	case <-ctx.Done():
		return nil, errors.Wrap(ctx.Err(), "unable to read value")
	default:
	}

	b, err := p.API.KVGet(key)
	if err != nil {
		return nil, errors.Wrap(err, "unable to read value")
	}
	return b, nil
}

func (p *HelpersImpl) kvCompareAndSetWithContext(ctx context.Context, key string, oldValue, newValue []byte) (bool, error) {
	select {
	case <-ctx.Done():
		return false, errors.Wrap(ctx.Err(), "unable to modify old value")
	default:
	}

	ok, err := p.API.KVCompareAndSet(key, oldValue, newValue)
	if err != nil {
		return ok, errors.Wrap(err, "unable to modify old value")
	}
	return ok, nil
}
