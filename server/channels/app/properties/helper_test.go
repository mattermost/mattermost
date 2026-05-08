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
	service    *PropertyService
	dbStore    store.Store
	Context    *request.Context
	CPAGroupID string
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
	logger := mlog.CreateConsoleTestLogger(tb)
	service, err := New(ServiceConfig{
		PropertyGroupStore: s.PropertyGroup(),
		PropertyFieldStore: s.PropertyField(),
		PropertyValueStore: s.PropertyValue(),
		CallerIDExtractor: func(rctx request.CTX) string {
			if rctx == nil {
				return ""
			}
			callerID, _ := model.CallerIDFromContext(rctx.Context())
			return callerID
		},
	})
	require.NoError(tb, err)

	// Create and wire the PropertyAccessService
	pas := NewPropertyAccessService(service, nil)
	service.SetPropertyAccessService(pas)

	tb.Cleanup(func() {
		s.Close()
	})

	return &TestHelper{
		service: service,
		dbStore: s,
		Context: request.EmptyContext(logger),
	}
}

// RequestContextWithCallerID adds the caller ID to a request.CTX for access control purposes.
func RequestContextWithCallerID(rctx request.CTX, callerID string) request.CTX {
	ctx := model.WithCallerID(rctx.Context(), callerID)
	return rctx.WithContext(ctx)
}

func (th *TestHelper) RegisterCPAPropertyGroup(tb testing.TB) *TestHelper {
	// Register the CPA group so requiresAccessControl can always look it up
	group, groupErr := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: model.CustomProfileAttributesPropertyGroupName, Version: model.PropertyGroupVersionV1})
	require.NoError(tb, groupErr)
	th.CPAGroupID = group.ID

	return th
}

// RegisterPropertyGroup registers a new property group with the given version and a unique name.
func (th *TestHelper) RegisterPropertyGroup(tb testing.TB, version int) *model.PropertyGroup {
	tb.Helper()
	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{
		Name:    model.NewId(),
		Version: version,
	})
	require.NoError(tb, err)
	return group
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
		Password:      model.NewTestPassword(),
		EmailVerified: true,
	}
	user, err := th.dbStore.User().Save(th.Context, user)
	require.NoError(tb, err)
	return user
}

// CreatePropertyField creates a property field using the service (with access control routing)
func (th *TestHelper) CreatePropertyField(tb testing.TB, rctx request.CTX, field *model.PropertyField) *model.PropertyField {
	result, err := th.service.CreatePropertyField(rctx, field)
	require.NoError(tb, err)
	return result
}

// CreatePropertyFieldDirect creates a property field directly via store (bypasses conflict check and access control)
func (th *TestHelper) CreatePropertyFieldDirect(tb testing.TB, field *model.PropertyField) *model.PropertyField {
	result, err := th.dbStore.PropertyField().Create(field)
	require.NoError(tb, err)
	return result
}

// CreatePropertyValue creates a property value using the service (with access control routing)
func (th *TestHelper) CreatePropertyValue(tb testing.TB, rctx request.CTX, value *model.PropertyValue) *model.PropertyValue {
	result, err := th.service.CreatePropertyValue(rctx, value)
	require.NoError(tb, err)
	return result
}
