// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config

import "github.com/pkg/errors"

func Migrate(from, to string) error {
	sourceStore, err := NewStore(from, false)
	if err != nil {
		return errors.Wrapf(err, "failed to access config %s", from)
	}

	destinationStore, err := NewStore(to, false)
	if err != nil {
		return errors.Wrapf(err, "failed to access config %s", to)
	}

	_, err = destinationStore.Set(sourceStore.Get())

	return err
}
