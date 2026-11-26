// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestGroupStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	mockStore := th.App.Srv().Store().(*storemocks.Store)
	groupMock := &storemocks.GroupStore{}
	mockStore.On("Group").Return(groupMock)

	notFound := fmt.Errorf("query: %w", store.NewErrNotFound("Group", model.NewId()))
	invalid := fmt.Errorf("query: %w", store.NewErrInvalidInput("Group", "id", "x"))
	unique := fmt.Errorf("query: %w", store.NewErrUniqueConstraint("Name"))
	plain := errors.New("db down")
	appErr := model.NewAppError("Store", "app.custom.error", nil, "", http.StatusTeapot)
	wrappedAppErr := fmt.Errorf("wrap: %w", appErr)

	type tc struct {
		err    error
		id     string
		status int
	}

	run := func(t *testing.T, method string, nArgs int, call func() *model.AppError, cases []tc) {
		t.Helper()
		args := make([]any, nArgs)
		for i := range args {
			args[i] = mock.Anything
		}
		for _, c := range cases {
			groupMock.On(method, args...).Return(nil, c.err).Once()
			got := call()
			require.NotNil(t, got)
			assert.Equal(t, c.id, got.Id)
			assert.Equal(t, c.status, got.StatusCode)
		}
	}

	nfCase := func(id string) tc { return tc{notFound, id, http.StatusNotFound} }
	plainCase := func(id string) tc { return tc{plain, id, http.StatusInternalServerError} }
	group := &model.Group{}

	t.Run("GetGroup", func(t *testing.T) {
		run(t, "Get", 1, func() *model.AppError {
			_, err := th.App.GetGroup("id", nil, nil)
			return err
		}, []tc{nfCase("app.group.no_rows"), plainCase("app.select_error")})
	})

	t.Run("GetGroupByName", func(t *testing.T) {
		run(t, "GetByName", 2, func() *model.AppError {
			_, err := th.App.GetGroupByName("name", model.GroupSearchOpts{})
			return err
		}, []tc{nfCase("app.group.no_rows"), plainCase("app.select_error")})
	})

	t.Run("GetGroupByRemoteID", func(t *testing.T) {
		run(t, "GetByRemoteID", 2, func() *model.AppError {
			_, err := th.App.GetGroupByRemoteID("id", model.GroupSourceCustom)
			return err
		}, []tc{nfCase("app.group.no_rows"), plainCase("app.select_error")})
	})

	t.Run("CreateGroup", func(t *testing.T) {
		run(t, "Create", 1, func() *model.AppError {
			_, err := th.App.CreateGroup(group)
			return err
		}, []tc{
			{wrappedAppErr, "app.custom.error", http.StatusTeapot},
			{invalid, "app.group.id.app_error", http.StatusBadRequest},
			plainCase("app.insert_error"),
		})
	})

	t.Run("CreateGroupWithUserIds", func(t *testing.T) {
		run(t, "CreateWithUserIds", 1, func() *model.AppError {
			_, err := th.App.CreateGroupWithUserIds(&model.GroupWithUserIds{})
			return err
		}, []tc{
			{wrappedAppErr, "app.custom.error", http.StatusTeapot},
			{invalid, "app.group.id.app_error", http.StatusBadRequest},
			{unique, "app.custom_group.unique_name", http.StatusBadRequest},
			plainCase("app.insert_error"),
		})
	})

	t.Run("UpdateGroup", func(t *testing.T) {
		run(t, "Update", 1, func() *model.AppError {
			_, err := th.App.UpdateGroup(group)
			return err
		}, []tc{
			{wrappedAppErr, "app.custom.error", http.StatusTeapot},
			nfCase("app.group.no_rows"),
			{unique, "app.custom_group.unique_name", http.StatusBadRequest},
			plainCase("app.select_error"),
		})
	})

	t.Run("DeleteGroup", func(t *testing.T) {
		run(t, "Delete", 1, func() *model.AppError {
			_, err := th.App.DeleteGroup("id")
			return err
		}, []tc{nfCase("app.group.no_rows"), plainCase("app.update_error")})
	})

	t.Run("RestoreGroup", func(t *testing.T) {
		run(t, "Restore", 1, func() *model.AppError {
			_, err := th.App.RestoreGroup("id")
			return err
		}, []tc{nfCase("app.group.no_rows"), plainCase("app.update_error")})
	})

	t.Run("UpsertGroupMember", func(t *testing.T) {
		run(t, "UpsertMember", 2, func() *model.AppError {
			_, err := th.App.UpsertGroupMember("gid", "uid")
			return err
		}, []tc{
			{wrappedAppErr, "app.custom.error", http.StatusTeapot},
			{invalid, "app.group.uniqueness_error", http.StatusBadRequest},
			{notFound, "app.group.user_not_found", http.StatusBadRequest},
			plainCase("app.update_error"),
		})
	})

	t.Run("DeleteGroupMember", func(t *testing.T) {
		run(t, "DeleteMember", 2, func() *model.AppError {
			_, err := th.App.DeleteGroupMember("gid", "uid")
			return err
		}, []tc{nfCase("app.group.no_rows"), plainCase("app.update_error")})
	})
}

func TestGroupSyncableAndMemberStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	mockStore := th.App.Srv().Store().(*storemocks.Store)
	groupMock := &storemocks.GroupStore{}
	userMock := &storemocks.UserStore{}
	channelMock := &storemocks.ChannelStore{}
	teamMock := &storemocks.TeamStore{}
	mockStore.On("Group").Return(groupMock)
	mockStore.On("User").Return(userMock)
	mockStore.On("Channel").Return(channelMock)
	mockStore.On("Team").Return(teamMock)

	notFound := fmt.Errorf("query: %w", store.NewErrNotFound("Group", model.NewId()))
	invalid := fmt.Errorf("query: %w", store.NewErrInvalidInput("Group", "id", "x"))
	plain := errors.New("db down")
	appErr := model.NewAppError("Store", "app.custom.error", nil, "", http.StatusTeapot)
	wrappedAppErr := fmt.Errorf("wrap: %w", appErr)

	check := func(t *testing.T, got *model.AppError, id string, status int) {
		t.Helper()
		require.NotNil(t, got)
		assert.Equal(t, id, got.Id)
		assert.Equal(t, status, got.StatusCode)
	}

	t.Run("isUniqueToUsernames", func(t *testing.T) {
		userMock.On("GetByUsername", "missing").Return(nil, notFound).Once()
		assert.Nil(t, th.App.isUniqueToUsernames("missing"))

		userMock.On("GetByUsername", "taken").Return(&model.User{}, nil).Once()
		check(t, th.App.isUniqueToUsernames("taken"), "app.group.username_conflict", http.StatusBadRequest)

		userMock.On("GetByUsername", "broken").Return(nil, plain).Once()
		check(t, th.App.isUniqueToUsernames("broken"), model.NoTranslation, http.StatusInternalServerError)
	})

	t.Run("UpsertGroupSyncable lookup", func(t *testing.T) {
		gs := model.NewGroupTeam("gid", "tid", false)
		groupMock.On("GetGroupSyncable", "gid", "tid", model.GroupSyncableTypeTeam).Return(nil, plain).Once()
		_, err := th.App.UpsertGroupSyncable(gs)
		check(t, err, "app.select_error", http.StatusInternalServerError)
	})

	t.Run("UpsertGroupSyncable create", func(t *testing.T) {
		gs := model.NewGroupTeam("gid", "tid", false)
		for _, c := range []struct {
			err    error
			id     string
			status int
		}{
			{wrappedAppErr, "app.custom.error", http.StatusTeapot},
			{notFound, "store.sql_channel.get.existing.app_error", http.StatusNotFound},
			{plain, "app.insert_error", http.StatusInternalServerError},
		} {
			groupMock.On("GetGroupSyncable", "gid", "tid", model.GroupSyncableTypeTeam).Return(nil, notFound).Once()
			groupMock.On("CreateGroupSyncable", gs).Return(nil, c.err).Once()
			_, err := th.App.UpsertGroupSyncable(gs)
			check(t, err, c.id, c.status)
		}
	})

	t.Run("UpsertGroupSyncable update", func(t *testing.T) {
		gs := model.NewGroupTeam("gid", "tid", false)
		for _, c := range []struct {
			err    error
			id     string
			status int
		}{
			{wrappedAppErr, "app.custom.error", http.StatusTeapot},
			{plain, "app.update_error", http.StatusInternalServerError},
		} {
			groupMock.On("GetGroupSyncable", "gid", "tid", model.GroupSyncableTypeTeam).Return(&model.GroupSyncable{}, nil).Once()
			groupMock.On("UpdateGroupSyncable", gs).Return(nil, c.err).Once()
			_, err := th.App.UpsertGroupSyncable(gs)
			check(t, err, c.id, c.status)
		}
	})

	t.Run("UpsertGroupSyncable channel parents", func(t *testing.T) {
		gs := model.NewGroupChannel("gid", "cid", false)
		for _, c := range []struct {
			err    error
			id     string
			status int
		}{
			{notFound, "app.channel.get.existing.app_error", http.StatusNotFound},
			{plain, "app.channel.get.find.app_error", http.StatusInternalServerError},
		} {
			groupMock.On("GetGroupSyncable", "gid", "cid", model.GroupSyncableTypeChannel).Return(nil, notFound).Once()
			channelMock.On("Get", "cid", true).Return(nil, c.err).Once()
			_, err := th.App.UpsertGroupSyncable(gs)
			check(t, err, c.id, c.status)
		}

		for _, c := range []struct {
			err    error
			id     string
			status int
		}{
			{notFound, "app.team.get.find.app_error", http.StatusNotFound},
			{plain, "app.team.get.finding.app_error", http.StatusInternalServerError},
		} {
			groupMock.On("GetGroupSyncable", "gid", "cid", model.GroupSyncableTypeChannel).Return(nil, notFound).Once()
			channelMock.On("Get", "cid", true).Return(&model.Channel{TeamId: "tid"}, nil).Once()
			teamMock.On("Get", "tid").Return(nil, c.err).Once()
			_, err := th.App.UpsertGroupSyncable(gs)
			check(t, err, c.id, c.status)
		}
	})

	t.Run("GetGroupSyncable", func(t *testing.T) {
		for _, c := range []struct {
			err    error
			id     string
			status int
		}{
			{notFound, "app.group.no_rows", http.StatusNotFound},
			{plain, "app.select_error", http.StatusInternalServerError},
		} {
			groupMock.On("GetGroupSyncable", "gid", "sid", model.GroupSyncableTypeTeam).Return(nil, c.err).Once()
			_, err := th.App.GetGroupSyncable("gid", "sid", model.GroupSyncableTypeTeam)
			check(t, err, c.id, c.status)
		}
	})

	t.Run("UpdateGroupSyncable", func(t *testing.T) {
		gs := model.NewGroupTeam("gid", "tid", false)
		for _, c := range []struct {
			err    error
			id     string
			status int
		}{
			{wrappedAppErr, "app.custom.error", http.StatusTeapot},
			{plain, "app.update_error", http.StatusInternalServerError},
		} {
			groupMock.On("UpdateGroupSyncable", gs).Return(nil, c.err).Once()
			_, err := th.App.UpdateGroupSyncable(gs)
			check(t, err, c.id, c.status)
		}
	})

	deleteCases := []struct {
		err    error
		id     string
		status int
	}{
		{notFound, "app.group.no_rows", http.StatusNotFound},
		{invalid, "app.group.group_syncable_already_deleted", http.StatusBadRequest},
		{plain, "app.update_error", http.StatusInternalServerError},
	}

	t.Run("DeleteGroupSyncable", func(t *testing.T) {
		for _, c := range deleteCases {
			groupMock.On("DeleteGroupSyncable", "gid", "sid", model.GroupSyncableTypeChannel).Return(nil, c.err).Once()
			_, err := th.App.DeleteGroupSyncable("gid", "sid", model.GroupSyncableTypeChannel)
			check(t, err, c.id, c.status)
		}
	})

	t.Run("DeleteGroupSyncable team channels", func(t *testing.T) {
		for _, c := range deleteCases {
			groupMock.On("DeleteGroupSyncable", "gid", "tid", model.GroupSyncableTypeTeam).
				Return(&model.GroupSyncable{GroupId: "gid", SyncableId: "tid", Type: model.GroupSyncableTypeTeam}, nil).Once()
			groupMock.On("GetAllGroupSyncablesByGroupId", "gid", model.GroupSyncableTypeChannel).
				Return([]*model.GroupSyncable{{GroupId: "gid", SyncableId: "cid", Type: model.GroupSyncableTypeChannel}}, nil).Once()
			groupMock.On("DeleteGroupSyncable", "gid", "cid", model.GroupSyncableTypeChannel).Return(nil, c.err).Once()
			_, err := th.App.DeleteGroupSyncable("gid", "tid", model.GroupSyncableTypeTeam)
			check(t, err, c.id, c.status)
		}
	})

	t.Run("UpsertGroupMembers", func(t *testing.T) {
		for _, c := range []struct {
			err    error
			id     string
			status int
		}{
			{wrappedAppErr, "app.custom.error", http.StatusTeapot},
			{invalid, "app.group.uniqueness_error", http.StatusBadRequest},
			{notFound, "app.group.user_not_found", http.StatusBadRequest},
			{plain, "app.update_error", http.StatusInternalServerError},
		} {
			groupMock.On("UpsertMembers", "gid", []string{"uid"}).Return(nil, c.err).Once()
			_, err := th.App.UpsertGroupMembers("gid", []string{"uid"})
			check(t, err, c.id, c.status)
		}
	})

	t.Run("DeleteGroupMembers", func(t *testing.T) {
		for _, c := range []struct {
			err    error
			id     string
			status int
		}{
			{wrappedAppErr, "app.custom.error", http.StatusTeapot},
			{invalid, "app.group.uniqueness_error", http.StatusBadRequest},
			{notFound, "app.group.user_not_found", http.StatusBadRequest},
			{plain, "app.update_error", http.StatusInternalServerError},
		} {
			groupMock.On("DeleteMembers", "gid", []string{"uid"}).Return(nil, c.err).Once()
			_, err := th.App.DeleteGroupMembers("gid", []string{"uid"})
			check(t, err, c.id, c.status)
		}
	})
}
