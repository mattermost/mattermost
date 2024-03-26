package pluginapi_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/pluginapi"
)

func TestCreateUser(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		expectedUser := &model.User{
			Username: "test",
		}
		api.On("CreateUser", expectedUser).Return(expectedUser, nil)

		err := client.User.Create(expectedUser)
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		expectedUser := &model.User{
			Username: "test",
		}
		api.On("CreateUser", expectedUser).Return(nil, newAppError())

		err := client.User.Create(expectedUser)
		require.EqualError(t, err, "here: id, an error occurred")
	})
}

func TestDeleteUser(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		expectedUserID := model.NewId()
		api.On("DeleteUser", expectedUserID).Return(nil)

		err := client.User.Delete(expectedUserID)
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		expectedUserID := model.NewId()
		api.On("DeleteUser", expectedUserID).Return(newAppError())

		err := client.User.Delete(expectedUserID)
		require.EqualError(t, err, "here: id, an error occurred")
	})
}

func TestGetUsers(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		options := &model.UserGetOptions{}
		expectedUsers := []*model.User{{Username: "test"}}
		api.On("GetUsers", options).Return(expectedUsers, nil)

		actualUsers, err := client.User.List(options)
		require.NoError(t, err)
		assert.Equal(t, expectedUsers, actualUsers)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		options := &model.UserGetOptions{}
		api.On("GetUsers", options).Return(nil, newAppError())

		actualUsers, err := client.User.List(options)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUsers)
	})
}

func TestGetUser(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		userID := "id"
		expectedUser := &model.User{Id: userID, Username: "test"}
		api.On("GetUser", userID).Return(expectedUser, nil)

		actualUser, err := client.User.Get(userID)
		require.NoError(t, err)
		assert.Equal(t, expectedUser, actualUser)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		userID := "id"
		api.On("GetUser", userID).Return(nil, newAppError())

		actualUser, err := client.User.Get(userID)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUser)
	})
}

func TestGetUserByEmail(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		email := "test@example.com"
		expectedUser := &model.User{Email: email, Username: "test"}
		api.On("GetUserByEmail", email).Return(expectedUser, nil)

		actualUser, err := client.User.GetByEmail(email)
		require.NoError(t, err)
		assert.Equal(t, expectedUser, actualUser)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		email := "test@example.com"
		api.On("GetUserByEmail", email).Return(nil, newAppError())

		actualUser, err := client.User.GetByEmail(email)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUser)
	})
}

func TestGetUserByUsername(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		username := "test"
		expectedUser := &model.User{Username: username}
		api.On("GetUserByUsername", username).Return(expectedUser, nil)

		actualUser, err := client.User.GetByUsername(username)
		require.NoError(t, err)
		assert.Equal(t, expectedUser, actualUser)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		username := "test"
		api.On("GetUserByUsername", username).Return(nil, newAppError())

		actualUser, err := client.User.GetByUsername(username)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUser)
	})
}

func TestGetUsersByUsernames(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		usernames := []string{"test1", "test2"}
		expectedUsers := []*model.User{{Username: "test1"}, {Username: "test2"}}
		api.On("GetUsersByUsernames", usernames).Return(expectedUsers, nil)

		actualUsers, err := client.User.ListByUsernames(usernames)
		require.NoError(t, err)
		assert.Equal(t, expectedUsers, actualUsers)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		usernames := []string{"test1", "test2"}
		api.On("GetUsersByUsernames", usernames).Return(nil, newAppError())

		actualUsers, err := client.User.ListByUsernames(usernames)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUsers)
	})
}

func TestGetUsersInTeam(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		teamID := "team_id"
		page := 1
		perPage := 10
		expectedUsers := []*model.User{{Username: "test1"}, {Username: "test2"}}
		api.On("GetUsersInTeam", teamID, page, perPage).Return(expectedUsers, nil)

		actualUsers, err := client.User.ListInTeam(teamID, page, perPage)
		require.NoError(t, err)
		assert.Equal(t, expectedUsers, actualUsers)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)
		client := pluginapi.NewClient(api, &plugintest.Driver{})

		teamID := "team_id"
		page := 1
		perPage := 10
		api.On("GetUsersInTeam", teamID, page, perPage).Return(nil, newAppError())

		actualUsers, err := client.User.ListInTeam(teamID, page, perPage)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUsers)
	})
}

func TestHasTeamUserPermission(t *testing.T) {
	api := &plugintest.API{}
	defer api.AssertExpectations(t)
	client := pluginapi.NewClient(api, &plugintest.Driver{})

	api.On("HasPermissionToTeam", "1", "2", &model.Permission{Id: "3"}).Return(true)

	ok := client.User.HasPermissionToTeam("1", "2", &model.Permission{Id: "3"})
	require.True(t, ok)
}
