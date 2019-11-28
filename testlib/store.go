// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package testlib

import (
	"github.com/mattermost/mattermost-server/v5/store"
)

type TestStore struct {
	store.Store
}

func (s *TestStore) Close() {
	// Don't propagate to the underlying store, since this instance is persistent.
}
