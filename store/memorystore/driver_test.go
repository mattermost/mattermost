// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package memorystore

import (
	"testing"

	"github.com/mattermost/mattermost-server/store/nosqlstore/nosqlstoretest"
)

func TestDriver(t *testing.T) {
	nosqlstoretest.TestDriver(t, &Driver{})
}
