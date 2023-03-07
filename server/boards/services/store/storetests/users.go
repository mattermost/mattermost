// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetests

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/store"
	"github.com/mattermost/mattermost-server/server/v8/boards/utils"
)

//nolint:dupl
func StoreTestUserStore(t *testing.T, setup func(t *testing.T) (store.Store, func())) {
	t.Run("GetUsersByTeam", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetUsersByTeam(t, store)
	})

	t.Run("CreateAndGetUser", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testCreateAndGetUser(t, store)
	})

	t.Run("GetUsersList", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testGetUsersList(t, store)
	})

	t.Run("CreateAndUpdateUser", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testCreateAndUpdateUser(t, store)
	})

	t.Run("CreateAndGetRegisteredUserCount", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testCreateAndGetRegisteredUserCount(t, store)
	})

	t.Run("TestPatchUserProps", func(t *testing.T) {
		store, tearDown := setup(t)
		defer tearDown()
		testPatchUserProps(t, store)
	})
}

func testGetUsersByTeam(t *testing.T, store store.Store) {
	t.Run("GetTeamUsers", func(t *testing.T) {
		users, err := store.GetUsersByTeam("team_1", "", false, false)
		require.Equal(t, 0, len(users))
		require.NoError(t, err)

		userID := utils.NewID(utils.IDTypeUser)

		user, err := store.CreateUser(&model.User{
			ID:       userID,
			Username: "darth.vader",
		})
		require.NoError(t, err)
		require.NotNil(t, user)
		require.Equal(t, userID, user.ID)
		require.Equal(t, "darth.vader", user.Username)

		defer func() {
			_, _ = store.UpdateUser(&model.User{
				ID:       userID,
				DeleteAt: utils.GetMillis(),
			})
		}()

		users, err = store.GetUsersByTeam("team_1", "", false, false)
		require.Equal(t, 1, len(users))
		require.Equal(t, "darth.vader", users[0].Username)
		require.NoError(t, err)
	})
}

func testCreateAndGetUser(t *testing.T, store store.Store) {
	user := &model.User{
		ID:       utils.NewID(utils.IDTypeUser),
		Username: "damao",
		Email:    "mock@email.com",
	}

	t.Run("CreateUser", func(t *testing.T) {
		newUser, err := store.CreateUser(user)
		require.NoError(t, err)
		require.NotNil(t, newUser)
	})

	t.Run("GetUserByID", func(t *testing.T) {
		got, err := store.GetUserByID(user.ID)
		require.NoError(t, err)
		require.Equal(t, user.ID, got.ID)
		require.Equal(t, user.Username, got.Username)
		require.Equal(t, user.Email, got.Email)
	})

	t.Run("GetUserByID nonexistent", func(t *testing.T) {
		got, err := store.GetUserByID("nonexistent-id")
		var nf *model.ErrNotFound
		require.ErrorAs(t, err, &nf)
		require.Nil(t, got)
	})

	t.Run("GetUserByUsername", func(t *testing.T) {
		got, err := store.GetUserByUsername(user.Username)
		require.NoError(t, err)
		require.Equal(t, user.ID, got.ID)
		require.Equal(t, user.Username, got.Username)
		require.Equal(t, user.Email, got.Email)
	})

	t.Run("GetUserByUsername nonexistent", func(t *testing.T) {
		got, err := store.GetUserByID("nonexistent-username")
		var nf *model.ErrNotFound
		require.ErrorAs(t, err, &nf)
		require.Nil(t, got)
	})

	t.Run("GetUserByEmail", func(t *testing.T) {
		got, err := store.GetUserByEmail(user.Email)
		require.NoError(t, err)
		require.Equal(t, user.ID, got.ID)
		require.Equal(t, user.Username, got.Username)
		require.Equal(t, user.Email, got.Email)
	})

	t.Run("GetUserByEmail nonexistent", func(t *testing.T) {
		got, err := store.GetUserByID("nonexistent-email")
		var nf *model.ErrNotFound
		require.ErrorAs(t, err, &nf)
		require.Nil(t, got)
	})
}

func testGetUsersList(t *testing.T, store store.Store) {
	for _, id := range []string{"user1", "user2"} {
		user := &model.User{
			ID:       id,
			Username: fmt.Sprintf("%s-username", id),
			Email:    fmt.Sprintf("%s@sample.com", id),
		}
		newUser, err := store.CreateUser(user)
		require.NoError(t, err)
		require.NotNil(t, newUser)
	}

	testCases := []struct {
		Name          string
		UserIDs       []string
		ExpectedError bool
		ExpectedIDs   []string
	}{
		{
			Name:          "all of the IDs are found",
			UserIDs:       []string{"user1", "user2"},
			ExpectedError: false,
			ExpectedIDs:   []string{"user1", "user2"},
		},
		{
			Name:          "some of the IDs are found",
			UserIDs:       []string{"user2", "non-existent"},
			ExpectedError: true,
			ExpectedIDs:   []string{"user2"},
		},
		{
			Name:          "none of the IDs are found",
			UserIDs:       []string{"non-existent-1", "non-existent-2"},
			ExpectedError: true,
			ExpectedIDs:   []string{},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			users, err := store.GetUsersList(tc.UserIDs, false, false)
			if tc.ExpectedError {
				require.Error(t, err)
				require.True(t, model.IsErrNotFound(err))
			} else {
				require.NoError(t, err)
			}

			userIDs := []string{}
			for _, user := range users {
				userIDs = append(userIDs, user.ID)
			}
			require.ElementsMatch(t, tc.ExpectedIDs, userIDs)
		})
	}
}

func testCreateAndUpdateUser(t *testing.T, store store.Store) {
	user := &model.User{
		ID: utils.NewID(utils.IDTypeUser),
	}
	newUser, err := store.CreateUser(user)
	require.NoError(t, err)
	require.NotNil(t, newUser)

	t.Run("UpdateUser", func(t *testing.T) {
		user.Username = "damao"
		user.Email = "mock@email.com"
		uUser, err := store.UpdateUser(user)
		require.NoError(t, err)
		require.NotNil(t, uUser)
		require.Equal(t, user.Username, uUser.Username)
		require.Equal(t, user.Email, uUser.Email)

		got, err := store.GetUserByID(user.ID)
		require.NoError(t, err)
		require.Equal(t, user.ID, got.ID)
		require.Equal(t, user.Username, got.Username)
		require.Equal(t, user.Email, got.Email)
	})

	t.Run("UpdateUserPassword", func(t *testing.T) {
		newPassword := utils.NewID(utils.IDTypeNone)
		err := store.UpdateUserPassword(user.Username, newPassword)
		require.NoError(t, err)

		got, err := store.GetUserByUsername(user.Username)
		require.NoError(t, err)
		require.Equal(t, user.Username, got.Username)
		require.Equal(t, newPassword, got.Password)
	})

	t.Run("UpdateUserPasswordByID", func(t *testing.T) {
		newPassword := utils.NewID(utils.IDTypeNone)
		err := store.UpdateUserPasswordByID(user.ID, newPassword)
		require.NoError(t, err)

		got, err := store.GetUserByID(user.ID)
		require.NoError(t, err)
		require.Equal(t, user.ID, got.ID)
		require.Equal(t, newPassword, got.Password)
	})
}

func testCreateAndGetRegisteredUserCount(t *testing.T, store store.Store) {
	randomN := int(time.Now().Unix() % 10)
	for i := 0; i < randomN; i++ {
		user, err := store.CreateUser(&model.User{
			ID: utils.NewID(utils.IDTypeUser),
		})
		require.NoError(t, err)
		require.NotNil(t, user)
	}

	got, err := store.GetRegisteredUserCount()
	require.NoError(t, err)
	require.Equal(t, randomN, got)
}

func testPatchUserProps(t *testing.T, store store.Store) {
	user := &model.User{
		ID: utils.NewID(utils.IDTypeUser),
	}
	newUser, err := store.CreateUser(user)
	require.NoError(t, err)
	require.NotNil(t, newUser)

	key1 := "new_key_1"
	key2 := "new_key_2"
	key3 := "new_key_3"

	// Only update props
	patch := model.UserPreferencesPatch{
		UpdatedFields: map[string]string{
			key1: "new_value_1",
			key2: "new_value_2",
			key3: "new_value_3",
		},
	}

	userPreferences, err := store.PatchUserPreferences(user.ID, patch)
	require.NoError(t, err)
	require.Equal(t, 3, len(userPreferences))

	for _, preference := range userPreferences {
		switch preference.Name {
		case key1:
			require.Equal(t, "new_value_1", preference.Value)
		case key2:
			require.Equal(t, "new_value_2", preference.Value)
		case key3:
			require.Equal(t, "new_value_3", preference.Value)
		}
	}

	// Delete a prop
	patch = model.UserPreferencesPatch{
		DeletedFields: []string{
			key1,
		},
	}

	userPreferences, err = store.PatchUserPreferences(user.ID, patch)
	require.NoError(t, err)

	for _, preference := range userPreferences {
		switch preference.Name {
		case key1:
			t.Errorf("new_key_1 shouldn't exist in user preference as we just deleted it")
		case key2:
			require.Equal(t, "new_value_2", preference.Value)
		case key3:
			require.Equal(t, "new_value_3", preference.Value)
		}
	}

	// update and delete together
	patch = model.UserPreferencesPatch{
		UpdatedFields: map[string]string{
			key3: "new_value_3_new_again",
		},
		DeletedFields: []string{
			key2,
		},
	}
	userPreferences, err = store.PatchUserPreferences(user.ID, patch)
	require.NoError(t, err)

	for _, preference := range userPreferences {
		switch preference.Name {
		case key1:
			t.Errorf("new_key_1 shouldn't exist in user preference as we just deleted it")
		case key2:
			t.Errorf("new_key_2 shouldn't exist in user preference as we just deleted it")
		case key3:
			require.Equal(t, "new_value_3_new_again", preference.Value)
		}
	}
}
