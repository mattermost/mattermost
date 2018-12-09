// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package testlib

import (
	"github.com/mattermost/mattermost-server/store"
)

type TestStore struct {
	store.Store
}

func (*TestStore) Close() {
}
