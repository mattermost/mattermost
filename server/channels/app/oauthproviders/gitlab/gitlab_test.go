// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package oauthgitlab

import (
	"bytes"
	"encoding/json"
	"strconv"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGitLabUserFromJSON(t *testing.T) {
	rctx := request.TestContext(t)
	glu := GitLabUser{
		Id:       12345,
		Username: "testuser",
		Login:    "testlogin",
		Email:    "test@example.com",
		Name:     "Test User",
	}

	provider := &GitLabProvider{}

	t.Run("valid gitlab user", func(t *testing.T) {
		b, err := json.Marshal(glu)
		require.NoError(t, err)

		userJSON, err := provider.GetUserFromJSON(rctx, bytes.NewReader(b), nil, nil)
		require.NoError(t, err)
		// We get AuthData via GetUserFromJSON which calls userFromGitLabUser which calls getAuthData
		require.Equal(t, strconv.FormatInt(glu.Id, 10), *userJSON.AuthData)

		// Check GetAuthDataFromJSON indirectly by ensuring GetUserFromJSON worked,
		// as GetAuthDataFromJSON is not directly exported or used elsewhere in a testable way without duplicating logic.
		// It relies on gitLabUserFromJSON and glu.IsValid, which are tested separately.
	})

	t.Run("empty body should fail validation", func(t *testing.T) {
		// GetUserFromJSON should return an error because IsValid fails on the empty user
		_, err := provider.GetUserFromJSON(rctx, strings.NewReader("{}"), nil, nil)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "user id can't be 0")
	})

	t.Run("invalid json", func(t *testing.T) {
		_, err := provider.GetUserFromJSON(rctx, strings.NewReader("invalid json"), nil, nil)
		require.Error(t, err)
	})
}

func TestGitLabUserIsValid(t *testing.T) {
	testCases := []struct {
		description string
		user        GitLabUser
		isValid     bool
		expectedErr string
	}{
		{"valid user", GitLabUser{Id: 1, Email: "test@example.com"}, true, ""},
		{"zero id", GitLabUser{Id: 0, Email: "test@example.com"}, false, "user id can't be 0"},
		{"empty email", GitLabUser{Id: 1, Email: ""}, false, "user e-mail should not be empty"},
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			err := tc.user.IsValid()
			if tc.isValid {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				assert.Equal(t, tc.expectedErr, err.Error())
			}
		})
	}
}

func TestGitLabUserGetAuthData(t *testing.T) {
	glu := GitLabUser{Id: 98765}
	assert.Equal(t, "98765", glu.getAuthData())
}

func TestUserFromGitLabUser(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	testCases := []struct {
		description          string
		gitlabUser           GitLabUser
		usePreferredUsername bool
		expectedUsername     string
		expectedFirstName    string
		expectedLastName     string
		expectedEmail        string
		expectedAuthData     string
	}{
		{
			description: "Username from PreferredUsername when UsePreferredUsername=true",
			gitlabUser: GitLabUser{
				Id:                1,
				Username:          "gitlab.user",
				Login:             "gitlab.login",
				Email:             "test@example.com",
				Name:              "First Last",
				PreferredUsername: "preferred.user",
			},
			usePreferredUsername: true,
			expectedUsername:     "preferred.user",
			expectedFirstName:    "First",
			expectedLastName:     "Last",
			expectedEmail:        "test@example.com",
			expectedAuthData:     "1",
		},
		{
			description: "Username from Username when UsePreferredUsername=false even if PreferredUsername exists",
			gitlabUser: GitLabUser{
				Id:                2,
				Username:          "gitlab.user",
				Login:             "gitlab.login",
				Email:             "test2@example.com",
				Name:              "First Last",
				PreferredUsername: "preferred.user",
			},
			usePreferredUsername: false,
			expectedUsername:     "gitlab.user",
			expectedFirstName:    "First",
			expectedLastName:     "Last",
			expectedEmail:        "test2@example.com",
			expectedAuthData:     "2",
		},
		{
			description: "Username from Username when PreferredUsername is empty and UsePreferredUsername=true",
			gitlabUser: GitLabUser{
				Id:                3,
				Username:          "gitlab.user.only",
				Login:             "gitlab.login",
				Email:             "test3@example.com",
				Name:              "Another User",
				PreferredUsername: "",
			},
			usePreferredUsername: true,
			expectedUsername:     "gitlab.user.only",
			expectedFirstName:    "Another",
			expectedLastName:     "User",
			expectedEmail:        "test3@example.com",
			expectedAuthData:     "3",
		},
		{
			description: "Username from PreferredUsername when Username is empty and UsePreferredUsername=true",
			gitlabUser: GitLabUser{
				Id:                5,
				Username:          "",
				Login:             "gitlab.login.only",
				Email:             "test5@example.com",
				Name:              "Login User",
				PreferredUsername: "preferred.user.again",
			},
			usePreferredUsername: true,
			expectedUsername:     "preferred.user.again",
			expectedFirstName:    "Login",
			expectedLastName:     "User",
			expectedEmail:        "test5@example.com",
			expectedAuthData:     "5",
		},
		{
			description: "Username from Login when Username is empty and UsePreferredUsername=false, even if PreferredUsername exists",
			gitlabUser: GitLabUser{
				Id:                6,
				Username:          "",
				Login:             "gitlab.login.only.again",
				Email:             "test6@example.com",
				Name:              "Login User",
				PreferredUsername: "preferred.user.ignored",
			},
			usePreferredUsername: false,
			expectedUsername:     "gitlab.login.only.again",
			expectedFirstName:    "Login",
			expectedLastName:     "User",
			expectedEmail:        "test6@example.com",
			expectedAuthData:     "6",
		},
		{
			description: "Username from Login when Username and PreferredUsername are empty and UsePreferredUsername=true",
			gitlabUser: GitLabUser{
				Id:                7,
				Username:          "",
				Login:             "the.login",
				Email:             "test7@example.com",
				Name:              "Just Login",
				PreferredUsername: "",
			},
			usePreferredUsername: true,
			expectedUsername:     "the.login",
			expectedFirstName:    "Just",
			expectedLastName:     "Login",
			expectedEmail:        "test7@example.com",
			expectedAuthData:     "7",
		},
		{
			description: "Name splitting: single name",
			gitlabUser: GitLabUser{
				Id:       9,
				Username: "testuser9",
				Email:    "test9@example.com",
				Name:     "Mononym",
			},
			usePreferredUsername: false,
			expectedUsername:     "testuser9",
			expectedFirstName:    "Mononym",
			expectedLastName:     "",
			expectedEmail:        "test9@example.com",
			expectedAuthData:     "9",
		},
		{
			description: "Name splitting: multiple last names",
			gitlabUser: GitLabUser{
				Id:       10,
				Username: "testuser10",
				Email:    "test10@example.com",
				Name:     "First Middle Van Der Lastname",
			},
			usePreferredUsername: false,
			expectedUsername:     "testuser10",
			expectedFirstName:    "First",
			expectedLastName:     "Middle Van Der Lastname",
			expectedEmail:        "test10@example.com",
			expectedAuthData:     "10",
		},
		{
			description: "Email lowercasing",
			gitlabUser: GitLabUser{
				Id:       11,
				Username: "testuser11",
				Email:    "TEST11@EXAMPLE.COM",
				Name:     "Test User",
			},
			usePreferredUsername: false,
			expectedUsername:     "testuser11",
			expectedFirstName:    "Test",
			expectedLastName:     "User",
			expectedEmail:        "test11@example.com",
			expectedAuthData:     "11",
		},
		{
			description: "Username needing cleaning when UsePreferredUsername=true",
			gitlabUser: GitLabUser{
				Id:                12,
				Username:          "gitlab.user",
				Login:             "gitlab.login",
				Email:             "test12@example.com",
				Name:              "Needs Clean",
				PreferredUsername: "preferred@@user!!",
			},
			usePreferredUsername: true,
			expectedUsername:     "preferred", // Cleaned
			expectedFirstName:    "Needs",
			expectedLastName:     "Clean",
			expectedEmail:        "test12@example.com",
			expectedAuthData:     "12",
		},
		{
			description: "Username needing cleaning when UsePreferredUsername=false",
			gitlabUser: GitLabUser{
				Id:                13,
				Username:          "gitlab@@user!!",
				Login:             "gitlab.login",
				Email:             "test13@example.com",
				Name:              "Needs Clean",
				PreferredUsername: "preferred.user",
			},
			usePreferredUsername: false,
			expectedUsername:     "gitlab--user", // Cleaned
			expectedFirstName:    "Needs",
			expectedLastName:     "Clean",
			expectedEmail:        "test13@example.com",
			expectedAuthData:     "13",
		},
		{
			description: "Login needing cleaning when UsePreferredUsername=false and Username is empty",
			gitlabUser: GitLabUser{
				Id:                14,
				Username:          "",
				Login:             "gitlab@@login!!",
				Email:             "test14@example.com",
				Name:              "Needs Clean",
				PreferredUsername: "preferred.user",
			},
			usePreferredUsername: false,
			expectedUsername:     "gitlab--login", // Cleaned
			expectedFirstName:    "Needs",
			expectedLastName:     "Clean",
			expectedEmail:        "test14@example.com",
			expectedAuthData:     "14",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			settings := &model.SSOSettings{
				UsePreferredUsername: model.NewPointer(tc.usePreferredUsername),
			}

			user := userFromGitLabUser(logger, &tc.gitlabUser, settings)

			require.NotNil(t, user)
			assert.Equal(t, tc.expectedUsername, user.Username)
			assert.Equal(t, tc.expectedFirstName, user.FirstName)
			assert.Equal(t, tc.expectedLastName, user.LastName)
			assert.Equal(t, tc.expectedEmail, user.Email)
			require.NotNil(t, user.AuthData)
			assert.Equal(t, tc.expectedAuthData, *user.AuthData)
			assert.Equal(t, model.UserAuthServiceGitlab, user.AuthService)
		})
	}
}
