// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

func TestCache(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	session := &model.Session{
		Id:     model.NewId(),
		Token:  model.NewId(),
		UserId: model.NewId(),
	}

	th.App.sessionCache.AddWithExpiresInSecs(session.Token, session, 5*60)

	keys := th.App.sessionCache.Keys()
	if len(keys) <= 0 {
		t.Fatal("should have items")
	}

	th.App.ClearSessionCacheForUser(session.UserId)

	rkeys := th.App.sessionCache.Keys()
	if len(rkeys) != len(keys)-1 {
		t.Fatal("should have one less")
	}
}

func TestGetSessionIdleTimeoutInMinutes(t *testing.T) {
	th := Setup().InitBasic()
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
	<-th.App.Srv.Store.Session().UpdateLastActivityAt(session.Id, time)
	th.App.ClearSessionCacheForUserSkipClusterSend(session.UserId)

	rsession, err = th.App.GetSession(session.Token)
	require.NotNil(t, err)
	assert.Equal(t, "api.context.invalid_token.error", err.Id)
	assert.Equal(t, "idle timeout", err.DetailedError)
	assert.Nil(t, rsession)

	// Test mobile session, should not timeout
	session = &model.Session{
		UserId:   model.NewId(),
		DeviceId: "android:" + model.NewId(),
	}

	session, _ = th.App.CreateSession(session)
	time = session.LastActivityAt - (1000 * 60 * 6)
	<-th.App.Srv.Store.Session().UpdateLastActivityAt(session.Id, time)
	th.App.ClearSessionCacheForUserSkipClusterSend(session.UserId)

	_, err = th.App.GetSession(session.Token)
	assert.Nil(t, err)

	// Test oauth session, should not timeout
	session = &model.Session{
		UserId:  model.NewId(),
		IsOAuth: true,
	}

	session, _ = th.App.CreateSession(session)
	time = session.LastActivityAt - (1000 * 60 * 6)
	<-th.App.Srv.Store.Session().UpdateLastActivityAt(session.Id, time)
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
	<-th.App.Srv.Store.Session().UpdateLastActivityAt(session.Id, time)
	th.App.ClearSessionCacheForUserSkipClusterSend(session.UserId)

	_, err = th.App.GetSession(session.Token)
	assert.Nil(t, err)

	// Test regular session with license off, should not timeout
	th.App.SetLicense(nil)

	session = &model.Session{
		UserId: model.NewId(),
	}

	session, _ = th.App.CreateSession(session)
	time = session.LastActivityAt - (1000 * 60 * 6)
	<-th.App.Srv.Store.Session().UpdateLastActivityAt(session.Id, time)
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
	<-th.App.Srv.Store.Session().UpdateLastActivityAt(session.Id, time)
	th.App.ClearSessionCacheForUserSkipClusterSend(session.UserId)

	_, err = th.App.GetSession(session.Token)
	assert.Nil(t, err)
}
