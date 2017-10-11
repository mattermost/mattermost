// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package memorystore

import (
	"github.com/mattermost/mattermost-server/store/nosqlstore"
)

func New() (*nosqlstore.NoSQLStore, error) {
	return nosqlstore.New(&Driver{})
}
