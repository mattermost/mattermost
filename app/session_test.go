// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestCache(t *testing.T) {
	th := Setup(t).InitBasic()
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

	th.App.Srv.sessionCache.AddWithExpiresInSecs(session.Token, session, 5*60)
	th.App.Srv.sessionCache.AddWithExpiresInSecs(session2.Token, session2, 5*60)

	keys := th.App.Srv.sessionCache.Keys()
	require.NotEmpty(t, keys)

	th.App.ClearSessionCacheForUser(session.UserId)

	rkeys := th.App.Srv.sessionCache.Keys()
	require.Lenf(t, rkeys, len(keys)-1, "should have one less: %d - %d != 1", len(keys), len(rkeys))
	require.NotEmpty(t, rkeys)

	th.App.ClearSessionCacheForAllUsers()

	rkeys = th.App.Srv.sessionCache.Keys()
	require.Empty(t, rkeys)
}

func TestGetSessionIdleTimeoutInMinutes(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	session := &model.Session{
		UserId: model.NewId(),
	}

	session, _ = th.App.CreateSession(session)

	th.App.SetLicense(model.NewTestLicense("compliance"))
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionIdleTimeoutInMinutes = 5 })

	rsession, err := th.App.GetSession(session.Token)
	require.Nil(t, err)
	assert.Equal(t, rsession.Id, session.Id)

	// Test regular session, should timeout
	time := session.LastActivityAt - (1000 * 60 * 6)
	err = th.App.Srv.Store.Session().UpdateLastActivityAt(session.Id, time)
	require.Nil(t, err)
	th.App.ClearSessionCacheForUserSkipClusterSend(session.UserId)

	rsession, err = th.App.GetSession(session.Token)
	require.NotNil(t, err)
	assert.Equal(t, "api.context.invalid_token.error", err.Id)
	assert.Equal(t, "idle timeout", err.DetailedError)
	assert.Nil(t, rsession)

	// Test oauth session, should not timeout
	session = &model.Session{
		UserId:  model.NewId(),
		IsOAuth: true,
	}

	session, _ = th.App.CreateSession(session)
	time = session.LastActivityAt - (1000 * 60 * 6)
	err = th.App.Srv.Store.Session().UpdateLastActivityAt(session.Id, time)
	require.Nil(t, err)
	th.App.ClearSessionCacheForUserSkipClusterSend(session.UserId)

	_, err = th.App.GetSession(session.Token)
	assert.Nil(t, err)

	// Test personal access token session, should not timeout
	session = &model.Session{
		UserId: model.NewId(),
	}
	session.AddProp(model.SESSION_PROP_TYPE, model.SESSION_TYPE_USER_ACCESS_TOKEN)

	session, _ = th.App.CreateSession(session)
	time = session.LastActivityAt - (1000 * 60 * 6)
	err = th.App.Srv.Store.Session().UpdateLastActivityAt(session.Id, time)
	require.Nil(t, err)
	th.App.ClearSessionCacheForUserSkipClusterSend(session.UserId)

	_, err = th.App.GetSession(session.Token)
	assert.Nil(t, err)

	th.App.SetLicense(model.NewTestLicense("compliance"))

	// Test regular session with timeout set to 0, should not timeout
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SessionIdleTimeoutInMinutes = 0 })

	session = &model.Session{
		UserId: model.NewId(),
	}

	session, _ = th.App.CreateSession(session)
	time = session.LastActivityAt - (1000 * 60 * 6)
	err = th.App.Srv.Store.Session().UpdateLastActivityAt(session.Id, time)
	require.Nil(t, err)
	th.App.ClearSessionCacheForUserSkipClusterSend(session.UserId)

	_, err = th.App.GetSession(session.Token)
	assert.Nil(t, err)
}

func TestUpdateSessionOnPromoteDemote(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.SetLicense(model.NewTestLicense())

	t.Run("Promote Guest to User updates the session", func(t *testing.T) {
		guest := th.CreateGuest()

		session, err := th.App.CreateSession(&model.Session{UserId: guest.Id, Props: model.StringMap{model.SESSION_PROP_IS_GUEST: "true"}})
		require.Nil(t, err)

		rsession, err := th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "true", rsession.Props[model.SESSION_PROP_IS_GUEST])

		err = th.App.PromoteGuestToUser(guest, th.BasicUser.Id)
		require.Nil(t, err)

		rsession, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "false", rsession.Props[model.SESSION_PROP_IS_GUEST])

		th.App.ClearSessionCacheForUser(session.UserId)

		rsession, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "false", rsession.Props[model.SESSION_PROP_IS_GUEST])
	})

	t.Run("Demote User to Guest updates the session", func(t *testing.T) {
		user := th.CreateUser()

		session, err := th.App.CreateSession(&model.Session{UserId: user.Id, Props: model.StringMap{model.SESSION_PROP_IS_GUEST: "false"}})
		require.Nil(t, err)

		rsession, err := th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "false", rsession.Props[model.SESSION_PROP_IS_GUEST])

		err = th.App.DemoteUserToGuest(user)
		require.Nil(t, err)

		rsession, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "true", rsession.Props[model.SESSION_PROP_IS_GUEST])

		th.App.ClearSessionCacheForUser(session.UserId)
		rsession, err = th.App.GetSession(session.Token)
		require.Nil(t, err)
		assert.Equal(t, "true", rsession.Props[model.SESSION_PROP_IS_GUEST])
	})
}
