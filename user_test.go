package pluginapi

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateUser(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		expectedUser := &model.User{
			Username: "test",
		}
		api.On("CreateUser", expectedUser).Return(expectedUser, nil)

		actualUser, err := client.User.CreateUser(expectedUser)
		require.NoError(t, err)
		assert.Equal(t, expectedUser, actualUser)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		expectedUser := &model.User{
			Username: "test",
		}
		api.On("CreateUser", expectedUser).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualUser, err := client.User.CreateUser(expectedUser)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUser)
	})
}

func TestDeleteUser(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		expectedUserID := model.NewId()
		api.On("DeleteUser", expectedUserID).Return(nil)

		err := client.User.DeleteUser(expectedUserID)
		require.NoError(t, err)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		expectedUserID := model.NewId()
		api.On("DeleteUser", expectedUserID).Return(model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		err := client.User.DeleteUser(expectedUserID)
		require.EqualError(t, err, "here: id, an error occurred")
	})
}

func TestGetUsers(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		options := &model.UserGetOptions{}
		expectedUsers := []*model.User{&model.User{Username: "test"}}
		api.On("GetUsers", options).Return(expectedUsers, nil)

		actualUsers, err := client.User.GetUsers(options)
		require.NoError(t, err)
		assert.Equal(t, expectedUsers, actualUsers)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		options := &model.UserGetOptions{}
		api.On("GetUsers", options).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualUsers, err := client.User.GetUsers(options)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUsers)
	})
}

func TestGetUser(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		userID := "id"
		expectedUser := &model.User{Id: userID, Username: "test"}
		api.On("GetUser", userID).Return(expectedUser, nil)

		actualUser, err := client.User.GetUser(userID)
		require.NoError(t, err)
		assert.Equal(t, expectedUser, actualUser)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		userID := "id"
		api.On("GetUser", userID).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualUser, err := client.User.GetUser(userID)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUser)
	})
}

func TestGetUserByEmail(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		email := "test@example.com"
		expectedUser := &model.User{Email: email, Username: "test"}
		api.On("GetUserByEmail", email).Return(expectedUser, nil)

		actualUser, err := client.User.GetUserByEmail(email)
		require.NoError(t, err)
		assert.Equal(t, expectedUser, actualUser)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		email := "test@example.com"
		api.On("GetUserByEmail", email).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualUser, err := client.User.GetUserByEmail(email)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUser)
	})
}

func TestGetUserByUsername(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		username := "test"
		expectedUser := &model.User{Username: username}
		api.On("GetUserByUsername", username).Return(expectedUser, nil)

		actualUser, err := client.User.GetUserByUsername(username)
		require.NoError(t, err)
		assert.Equal(t, expectedUser, actualUser)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		username := "test"
		api.On("GetUserByUsername", username).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualUser, err := client.User.GetUserByUsername(username)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUser)
	})
}

func TestGetUsersByUsernames(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		usernames := []string{"test1", "test2"}
		expectedUsers := []*model.User{&model.User{Username: "test1"}, &model.User{Username: "test2"}}
		api.On("GetUsersByUsernames", usernames).Return(expectedUsers, nil)

		actualUsers, err := client.User.GetUsersByUsernames(usernames)
		require.NoError(t, err)
		assert.Equal(t, expectedUsers, actualUsers)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		usernames := []string{"test1", "test2"}
		api.On("GetUsersByUsernames", usernames).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualUsers, err := client.User.GetUsersByUsernames(usernames)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUsers)
	})
}

func TestGetUsersInTeam(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		teamID := "team_id"
		page := 1
		perPage := 10
		expectedUsers := []*model.User{&model.User{Username: "test1"}, &model.User{Username: "test2"}}
		api.On("GetUsersInTeam", teamID, page, perPage).Return(expectedUsers, nil)

		actualUsers, err := client.User.GetUsersInTeam(teamID, page, perPage)
		require.NoError(t, err)
		assert.Equal(t, expectedUsers, actualUsers)
	})

	t.Run("failure", func(t *testing.T) {
		api := &plugintest.API{}
		defer api.AssertExpectations(t)

		client := NewClient(api)

		teamID := "team_id"
		page := 1
		perPage := 10
		api.On("GetUsersInTeam", teamID, page, perPage).Return(nil, model.NewAppError("here", "id", nil, "an error occurred", http.StatusInternalServerError))

		actualUsers, err := client.User.GetUsersInTeam(teamID, page, perPage)
		require.EqualError(t, err, "here: id, an error occurred")
		assert.Nil(t, actualUsers)
	})
}
