// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config

import "github.com/pkg/errors"

func Migrate(from, to string) error {
	// Get source config store - invalid config will throw error here
	fromConfigStore, err := NewStore(from, false)
	if err != nil {
		return errors.Wrapf(err, "failed to access config %s", from)
	}

	// Get destination config store
	toConfigStore, err := NewStore(to, false)
	if err != nil {
		return errors.Wrapf(err, "failed to access config %s", to)
	}

	// Copy config from source to destination
	_, err = toConfigStore.Set(fromConfigStore.Get())

	return err
}
