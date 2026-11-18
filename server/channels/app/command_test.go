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

func TestPossibleAtMentions(t *testing.T) {
	mainHelper.Parallel(t)
	fixture := []struct {
		message  string
		expected []string
	}{
		{
			"",
			[]string{},
		},
		{
			"@user",
			[]string{"user"},
		},
		{
			"@user-with_special.chars @multiple.-_chars",
			[]string{"user-with_special.chars", "multiple.-_chars"},
		},
		{
			"@repeated @user @repeated",
			[]string{"repeated", "user"},
		},
		{
			"@user1 @user2 @user3",
			[]string{"user1", "user2", "user3"},
		},
		{
			"@李",
			[]string{},
		},
		{
			"@withfinaldot. @withfinaldash- @withfinalunderscore_",
			[]string{
				"withfinaldot.",
				"withfinaldash-",
				"withfinalunderscore_",
			},
		},
	}

	for _, data := range fixture {
		actual := possibleAtMentions(data.message)
		require.ElementsMatch(t, actual, data.expected)
	}
}

func TestTrimUsernameSpecialChar(t *testing.T) {
	mainHelper.Parallel(t)
	fixture := []struct {
		word           string
		expectedString string
		expectedBool   bool
	}{
		{"user...", "user..", true},
		{"user..", "user.", true},
		{"user.", "user", true},
		{"user--", "user-", true},
		{"user-", "user", true},
		{"user_.-", "user_.", true},
		{"user_.", "user_", true},
		{"user_", "user", true},
		{"user", "user", false},
		{"user.with-inner_chars", "user.with.inner.chars", false},
	}

	for _, data := range fixture {
		actualString, actualBool := trimUsernameSpecialChar(data.word)
		require.Equal(t, actualBool, data.expectedBool)
		if actualBool {
			require.Equal(t, actualString, data.expectedString)
		} else {
			require.Equal(t, actualString, data.word)
		}
	}
}

func TestCommandStoreErrorClassification(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)
	*th.App.Config().ServiceSettings.EnableCommands = true

	mockStore := th.App.Srv().Store().(*storemocks.Store)

	notFound := func() error {
		return fmt.Errorf("query: %w", store.NewErrNotFound("Command", model.NewId()))
	}
	plain := func() error {
		return errors.New("db down")
	}
	storeAppErr := func() *model.AppError {
		return model.NewAppError("store", "store.app_error", nil, "", http.StatusConflict)
	}

	bindings := map[string]*mock.Call{}
	bind := func(name string, s any) {
		if previous := bindings[name]; previous != nil {
			previous.Unset()
		}
		bindings[name] = mockStore.On(name).Return(s)
	}
	newCommandStore := func() *storemocks.CommandStore {
		commandStore := &storemocks.CommandStore{}
		commandStore.On("GetByTeam", mock.Anything).Return([]*model.Command{}, nil)
		bind("Command", commandStore)
		return commandStore
	}

	t.Run("CreateCommand", func(t *testing.T) {
		cause := storeAppErr()
		commandStore := newCommandStore()
		commandStore.On("Save", mock.Anything).Return(nil, cause).Once()
		_, got := th.App.CreateCommand(&model.Command{TeamId: model.NewId(), Trigger: "Trigger"})
		require.NotNil(t, got)
		assert.Same(t, cause, got)

		commandStore = newCommandStore()
		commandStore.On("Save", mock.Anything).Return(nil, plain()).Once()
		_, got = th.App.CreateCommand(&model.Command{TeamId: model.NewId(), Trigger: "Trigger"})
		require.NotNil(t, got)
		assert.Equal(t, "app.command.createcommand.internal_error", got.Id)
		assert.Equal(t, http.StatusInternalServerError, got.StatusCode)
	})

	t.Run("GetCommand", func(t *testing.T) {
		commandStore := newCommandStore()
		commandStore.On("Get", mock.Anything).Return(nil, notFound()).Once()
		_, got := th.App.GetCommand(model.NewId())
		require.NotNil(t, got)
		assert.Equal(t, "store.sql_command.get.missing.app_error", got.Id)
		assert.Equal(t, http.StatusNotFound, got.StatusCode)

		commandStore = newCommandStore()
		commandStore.On("Get", mock.Anything).Return(nil, plain()).Once()
		_, got = th.App.GetCommand(model.NewId())
		require.NotNil(t, got)
		assert.Equal(t, "app.command.getcommand.internal_error", got.Id)
		assert.Equal(t, http.StatusInternalServerError, got.StatusCode)
	})

	updaters := map[string]struct {
		run      func() *model.AppError
		notFound string
		internal string
	}{
		"UpdateCommand": {
			run: func() *model.AppError {
				_, appErr := th.App.UpdateCommand(&model.Command{Id: model.NewId(), TeamId: model.NewId()}, &model.Command{Trigger: "trigger"})
				return appErr
			},
			notFound: "store.sql_command.update.missing.app_error",
			internal: "app.command.updatecommand.internal_error",
		},
		"MoveCommand": {
			run: func() *model.AppError {
				return th.App.MoveCommand(&model.Team{Id: model.NewId()}, &model.Command{Id: model.NewId(), Trigger: "trigger"})
			},
			notFound: "store.sql_command.update.missing.app_error",
			internal: "app.command.movecommand.internal_error",
		},
		"RegenCommandToken": {
			run: func() *model.AppError {
				_, appErr := th.App.RegenCommandToken(&model.Command{Id: model.NewId()})
				return appErr
			},
			notFound: "store.sql_command.update.missing.app_error",
			internal: "app.command.regencommandtoken.internal_error",
		},
	}
	for name, tc := range updaters {
		t.Run(name, func(t *testing.T) {
			commandStore := newCommandStore()
			commandStore.On("Update", mock.Anything).Return(nil, notFound()).Once()
			got := tc.run()
			require.NotNil(t, got)
			assert.Equal(t, tc.notFound, got.Id)
			assert.Equal(t, http.StatusNotFound, got.StatusCode)

			cause := storeAppErr()
			commandStore = newCommandStore()
			commandStore.On("Update", mock.Anything).Return(nil, cause).Once()
			got = tc.run()
			require.NotNil(t, got)
			assert.Same(t, cause, got)

			commandStore = newCommandStore()
			commandStore.On("Update", mock.Anything).Return(nil, plain()).Once()
			got = tc.run()
			require.NotNil(t, got)
			assert.Equal(t, tc.internal, got.Id)
			assert.Equal(t, http.StatusInternalServerError, got.StatusCode)
		})
	}

	t.Run("tryExecuteCustomCommand", func(t *testing.T) {
		args := &model.CommandArgs{TeamId: model.NewId(), UserId: model.NewId(), ChannelId: model.NewId()}

		run := func(teamErr, userErr, channelErr error) *model.AppError {
			newCommandStore()
			teamStore := &storemocks.TeamStore{}
			teamStore.On("Get", mock.Anything).Return(&model.Team{Id: args.TeamId}, teamErr)
			userStore := &storemocks.UserStore{}
			userStore.On("Get", mock.Anything, mock.Anything).Return(&model.User{Id: args.UserId}, userErr)
			channelStore := &storemocks.ChannelStore{}
			channelStore.On("Get", mock.Anything, mock.Anything).Return(&model.Channel{Id: args.ChannelId}, channelErr)
			bind("Team", teamStore)
			bind("User", userStore)
			bind("Channel", channelStore)
			_, _, appErr := th.App.tryExecuteCustomCommand(th.Context, args, "trigger", "")
			return appErr
		}

		got := run(notFound(), nil, nil)
		require.NotNil(t, got)
		assert.Equal(t, "app.team.get.find.app_error", got.Id)
		assert.Equal(t, http.StatusNotFound, got.StatusCode)

		got = run(plain(), nil, nil)
		require.NotNil(t, got)
		assert.Equal(t, "app.team.get.finding.app_error", got.Id)
		assert.Equal(t, http.StatusInternalServerError, got.StatusCode)

		got = run(nil, notFound(), nil)
		require.NotNil(t, got)
		assert.Equal(t, MissingAccountError, got.Id)
		assert.Equal(t, http.StatusNotFound, got.StatusCode)

		got = run(nil, plain(), nil)
		require.NotNil(t, got)
		assert.Equal(t, "app.user.get.app_error", got.Id)
		assert.Equal(t, http.StatusInternalServerError, got.StatusCode)

		got = run(nil, nil, notFound())
		require.NotNil(t, got)
		assert.Equal(t, "app.channel.get.existing.app_error", got.Id)
		assert.Equal(t, http.StatusNotFound, got.StatusCode)

		got = run(nil, nil, plain())
		require.NotNil(t, got)
		assert.Equal(t, "app.channel.get.find.app_error", got.Id)
		assert.Equal(t, http.StatusInternalServerError, got.StatusCode)
	})
}
