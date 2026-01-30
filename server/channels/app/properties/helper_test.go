// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

type TestHelper struct {
	service *PropertyService
	dbStore store.Store
	Context *request.Context
}

func Setup(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()

	return setupTestHelper(dbStore, tb)
}

func setupTestHelper(s store.Store, tb testing.TB) *TestHelper {
	service, err := New(ServiceConfig{
		PropertyGroupStore: s.PropertyGroup(),
		PropertyFieldStore: s.PropertyField(),
		PropertyValueStore: s.PropertyValue(),
	})
	require.NoError(tb, err)

	return &TestHelper{
		service: service,
		dbStore: s,
		Context: request.EmptyContext(mlog.CreateConsoleTestLogger(tb)),
	}
}

// CreateTeam creates a team for testing hierarchy
func (th *TestHelper) CreateTeam(tb testing.TB) *model.Team {
	team := &model.Team{
		DisplayName: "Test Team " + model.NewId(),
		Name:        "team" + model.NewId(),
		Type:        model.TeamOpen,
	}
	team, err := th.dbStore.Team().Save(team)
	require.NoError(tb, err)
	return team
}

// CreateChannel creates a channel in the given team
func (th *TestHelper) CreateChannel(tb testing.TB, teamID string) *model.Channel {
	channel := &model.Channel{
		TeamId:      teamID,
		DisplayName: "Test Channel " + model.NewId(),
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, err := th.dbStore.Channel().Save(th.Context, channel, 10000)
	require.NoError(tb, err)
	return channel
}

// CreateDMChannel creates a DM channel (no team association)
func (th *TestHelper) CreateDMChannel(tb testing.TB) *model.Channel {
	// Create two users for the DM
	user1 := th.CreateUser(tb)
	user2 := th.CreateUser(tb)

	channel, err := th.dbStore.Channel().CreateDirectChannel(th.Context, user1, user2)
	require.NoError(tb, err)
	return channel
}

// CreateUser creates a user for testing
func (th *TestHelper) CreateUser(tb testing.TB) *model.User {
	id := model.NewId()
	user := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      "Password1",
		EmailVerified: true,
	}
	user, err := th.dbStore.User().Save(th.Context, user)
	require.NoError(tb, err)
	return user
}

// CreatePropertyField creates a property field using the service
func (th *TestHelper) CreatePropertyField(tb testing.TB, field *model.PropertyField) *model.PropertyField {
	result, err := th.service.CreatePropertyField(field)
	require.NoError(tb, err)
	return result
}

// CreatePropertyFieldDirect creates a property field directly via store (bypasses conflict check)
func (th *TestHelper) CreatePropertyFieldDirect(tb testing.TB, field *model.PropertyField) *model.PropertyField {
	result, err := th.dbStore.PropertyField().Create(field)
	require.NoError(tb, err)
	return result
}
