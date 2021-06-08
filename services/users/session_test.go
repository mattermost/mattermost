// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package users

import (
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestCache(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	session := &model.Session{
		Id:     model.NewId(),
		Token:  model.NewId(),
		UserId: model.NewId(),
	}

	session2 := &model.Session{
		Id:     model.NewId(),
		Token:  model.NewId(),
		UserId: model.NewId(),
	}

	th.service.sessionCache.SetWithExpiry(session.Token, session, 5*time.Minute)
	th.service.sessionCache.SetWithExpiry(session2.Token, session2, 5*time.Minute)

	keys, err := th.service.sessionCache.Keys()
	require.NoError(t, err)
	require.NotEmpty(t, keys)

	th.service.ClearSessionCacheForUser(session.UserId)

	rkeys, err := th.service.sessionCache.Keys()
	require.NoError(t, err)
	require.Lenf(t, rkeys, len(keys)-1, "should have one less: %d - %d != 1", len(keys), len(rkeys))
	require.NotEmpty(t, rkeys)

	th.service.ClearSessionCacheForAllUsers()

	rkeys, err = th.service.sessionCache.Keys()
	require.NoError(t, err)
	require.Empty(t, rkeys)
}
