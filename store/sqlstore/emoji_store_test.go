// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/adacta-ru/mattermost-server/v5/store/storetest"
)

func TestEmojiStore(t *testing.T) {
	StoreTest(t, storetest.TestEmojiStore)
}
