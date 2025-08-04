package oauthopenid

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenIDProvider_GetUserFromJSON(t *testing.T) {
	tests := []struct {
		name           string
		openIDUser     *OpenIDUser
		expectedUsername string
		description    string
	}{
		{
			name: "preferred_username_priority",
			openIDUser: &OpenIDUser{
				Sub:              "12345",
				PreferredUsername: "john.doe",
				Username:         "johndoe",
				Nickname:         "johnny",
				Email:            "john.doe@example.com",
				Name:             "John Doe",
			},
			expectedUsername: "john.doe",
			description:     "Should prioritize preferred_username over other claims",
		},
		{
			name: "username_fallback",
			openIDUser: &OpenIDUser{
				Sub:              "12346",
				PreferredUsername: "",
				Username:         "johndoe",
				Nickname:         "johnny",
				Email:            "john.doe@example.com",
				Name:             "John Doe",
			},
			expectedUsername: "johndoe",
			description:     "Should use username when preferred_username is empty",
		},
		{
			name: "nickname_fallback",
			openIDUser: &OpenIDUser{
				Sub:              "12347",
				PreferredUsername: "",
				Username:         "",
				Nickname:         "johnny",
				Email:            "john.doe@example.com",
				Name:             "John Doe",
			},
			expectedUsername: "johnny",
			description:     "Should use nickname when preferred_username and username are empty",
		},
		{
			name: "email_local_part_fallback",
			openIDUser: &OpenIDUser{
				Sub:              "12348",
				PreferredUsername: "",
				Username:         "",
				Nickname:         "",
				Email:            "john.doe@example.com",
				Name:             "John Doe",
			},
			expectedUsername: "john.doe",
			description:     "Should use email local-part when all username claims are empty",
		},
		{
			name: "email_without_at_fallback",
			openIDUser: &OpenIDUser{
				Sub:              "12349",
				PreferredUsername: "",
				Username:         "",
				Nickname:         "",
				Email:            "johndoe",
				Name:             "John Doe",
			},
			expectedUsername: "johndoe",
			description:     "Should handle email without @ symbol",
		},
	}

	provider := &OpenIDProvider{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Convert OpenIDUser to JSON
			jsonData, err := json.Marshal(tt.openIDUser)
			require.NoError(t, err)

			// Create a mock context
			c := request.TestContext(t)

			// Call GetUserFromJSON
			user, err := provider.GetUserFromJSON(c, bytes.NewReader(jsonData), nil)
			require.NoError(t, err)
			require.NotNil(t, user)

			// Verify the username is set correctly
			assert.Equal(t, tt.expectedUsername, user.Username, tt.description)
			assert.Equal(t, model.ServiceOpenid, user.AuthService)
			assert.Equal(t, strings.ToLower(tt.openIDUser.Email), user.Email)
		})
	}
}

func TestOpenIDProvider_GetUserFromJSON_InvalidData(t *testing.T) {
	provider := &OpenIDProvider{}
	c := request.TestContext(t)

	// Test with invalid JSON
	invalidJSON := `{"invalid": json}`
	_, err := provider.GetUserFromJSON(c, bytes.NewReader([]byte(invalidJSON)), nil)
	assert.Error(t, err)

	// Test with missing required fields
	incompleteUser := &OpenIDUser{
		Email: "test@example.com",
		// Missing Sub field
	}
	jsonData, err := json.Marshal(incompleteUser)
	require.NoError(t, err)
	_, err = provider.GetUserFromJSON(c, bytes.NewReader(jsonData), nil)
	assert.Error(t, err)

	// Test with empty email
	userWithoutEmail := &OpenIDUser{
		Sub:   "12345",
		Email: "",
	}
	jsonData, err = json.Marshal(userWithoutEmail)
	require.NoError(t, err)
	_, err = provider.GetUserFromJSON(c, bytes.NewReader(jsonData), nil)
	assert.Error(t, err)
}

func TestOpenIDProvider_IsSameUser(t *testing.T) {
	provider := &OpenIDProvider{}
	c := request.TestContext(t)

	dbUser := &model.User{
		AuthData: model.NewPointer("12345"),
	}
	oauthUser := &model.User{
		AuthData: model.NewPointer("12345"),
	}

	// Same auth data should return true
	assert.True(t, provider.IsSameUser(c, dbUser, oauthUser))

	// Different auth data should return false
	oauthUser.AuthData = model.NewPointer("67890")
	assert.False(t, provider.IsSameUser(c, dbUser, oauthUser))
}

func TestOpenIDUser_IsValid(t *testing.T) {
	// Test valid user
	validUser := &OpenIDUser{
		Sub:   "12345",
		Email: "test@example.com",
	}
	err := validUser.IsValid()
	assert.NoError(t, err)

	// Test invalid user - missing sub
	invalidUser1 := &OpenIDUser{
		Email: "test@example.com",
	}
	err = invalidUser1.IsValid()
	assert.Error(t, err)

	// Test invalid user - missing email
	invalidUser2 := &OpenIDUser{
		Sub: "12345",
	}
	err = invalidUser2.IsValid()
	assert.Error(t, err)
}

func TestOpenIDUser_getAuthData(t *testing.T) {
	user := &OpenIDUser{
		Sub: "12345",
	}
	assert.Equal(t, "12345", user.getAuthData())
} 