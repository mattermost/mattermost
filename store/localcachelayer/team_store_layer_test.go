// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package localcachelayer

import (
	"testing"

	"github.com/mattermost/mattermost-server/store/storetest"
	"github.com/stretchr/testify/require"
)

func TestTeamStore(t *testing.T) {
	StoreTest(t, storetest.TestTeamStore)
}

func TestTeamStoreCache(t *testing.T) {
	fakeUserId := "123"
	_ := []string{"1", "2", "3"}

	t.Run("first call not cached, second cached and returning same data", func(t *testing.T) {
		mockStore := getMockStore()
		cachedStore := NewLocalCacheLayer(mockStore, nil, nil)

		_, err := cachedStore.Team().GetUserTeamIds(fakeUserId, true)
		require.Nil(t, err)
	})
}
