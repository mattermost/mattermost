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
