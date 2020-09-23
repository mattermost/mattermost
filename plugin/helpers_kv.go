// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"encoding/json"
	"strings"

	"github.com/pkg/errors"
)

// KVSetJSON implements Helpers.KVSetJSON.
func (p *HelpersImpl) KVSetJSON(key string, value interface{}) error {
	err := p.ensureServerVersion("5.2.0")
	if err != nil {
		return err
	}

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
	var err error

	err = p.ensureServerVersion("5.12.0")
	if err != nil {
		return false, err
	}
	var oldData, newData []byte

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
	var err error

	err = p.ensureServerVersion("5.16.0")
	if err != nil {
		return false, err
	}

	var oldData []byte

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
	err := p.ensureServerVersion("5.2.0")
	if err != nil {
		return false, err
	}

	data, appErr := p.API.KVGet(key)
	if appErr != nil {
		return false, appErr
	}
	if data == nil {
		return false, nil
	}

	err = json.Unmarshal(data, value)
	if err != nil {
		return false, err
	}

	return true, nil
}

// KVSetWithExpiryJSON is a wrapper around KVSetWithExpiry to simplify atomically writing a JSON object with expiry to the key value store.
func (p *HelpersImpl) KVSetWithExpiryJSON(key string, value interface{}, expireInSeconds int64) error {
	err := p.ensureServerVersion("5.6.0")
	if err != nil {
		return err
	}

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

type kvListOptions struct {
	checkers []func(key string) (keep bool, err error)
}

func (o *kvListOptions) checkAll(key string) (keep bool, err error) {
	for _, check := range o.checkers {
		keep, err := check(key)
		if err != nil {
			return false, err
		}
		if !keep {
			return false, nil
		}
	}

	// key made it through all checkers
	return true, nil
}

// KVListOption represents a single input option for KVListWithOptions
type KVListOption func(*kvListOptions)

// WithPrefix only return keys that start with the given string.
func WithPrefix(prefix string) KVListOption {
	return WithChecker(func(key string) (keep bool, err error) {
		return strings.HasPrefix(key, prefix), nil
	})
}

// WithChecker allows for a custom filter function to determine which keys to return.
// Returning true will keep the key and false will filter it out. Returning an error
// will halt KVListWithOptions immediately and pass the error up (with no other results).
func WithChecker(f func(key string) (keep bool, err error)) KVListOption {
	return func(args *kvListOptions) {
		args.checkers = append(args.checkers, f)
	}
}

// kvListPerPage is the number of keys KVListWithOptions gets per request
const kvListPerPage = 100

// KVListWithOptions implements Helpers.KVListWithOptions.
func (p *HelpersImpl) KVListWithOptions(options ...KVListOption) ([]string, error) {
	err := p.ensureServerVersion("5.6.0")
	if err != nil {
		return nil, err
	}
	// convert functional options into args struct
	args := &kvListOptions{}
	for _, opt := range options {
		opt(args)
	}
	ret := make([]string, 0)

	// get our keys a batch at a time, filter out the ones we don't want based on our args
	// any errors will hault the whole process and return the error raw
	for i := 0; ; i++ {
		keys, appErr := p.API.KVList(i, kvListPerPage)
		if appErr != nil {
			return nil, appErr
		}

		if len(args.checkers) == 0 {
			// no checkers, just append the whole block at once
			ret = append(ret, keys...)
		} else {
			// we have a filter, so check each key, all checkers must say key
			// for us to keep a key
			for _, key := range keys {
				keep, err := args.checkAll(key)
				if err != nil {
					return nil, err
				}
				if !keep {
					continue
				}

				// didn't get filtered out, add to our return
				ret = append(ret, key)
			}
		}

		if len(keys) < kvListPerPage {
			break
		}
	}

	return ret, nil
}
