package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

var (
	emptyString = ""
	someString  = "userorpass"
)

func newValidOAuthOutgoingConnection() *OAuthOutgoingConnection {
	return &OAuthOutgoingConnection{
		Id:            NewId(),
		CreatorId:     NewId(),
		Name:          "Test Connection",
		ClientId:      NewId(),
		ClientSecret:  NewId(),
		OAuthTokenURL: "https://nowhere.com/oauth/token",
		GrantType:     "client_credentials",
		CreateAt:      GetMillis(),
		UpdateAt:      GetMillis(),
		Audiences:     []string{"https://nowhere.com"},
	}
}

func TestOAuthOutgoingConnectionIsValid(t *testing.T) {
	var cases = []struct {
		name   string
		item   func() *OAuthOutgoingConnection
		assert func(t *testing.T, oa *OAuthOutgoingConnection)
	}{
		{
			name: "valid",
			item: func() *OAuthOutgoingConnection {
				return newValidOAuthOutgoingConnection()
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Nil(t, oa.IsValid())
			},
		},
		{
			name: "invalid id",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.Id = ""
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid create_at",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.CreateAt = 0
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid update_at",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.UpdateAt = 0
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid creator_id",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.CreatorId = ""
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid name",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.Name = ""
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid client_id",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.ClientId = ""
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "long client_id",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.ClientId = string(make([]byte, 257))
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid client_secret",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.ClientSecret = ""
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "long client_secret",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.ClientSecret = string(make([]byte, 257))
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "empty oauth_token_url",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.OAuthTokenURL = ""
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "long oauth_token_url",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.OAuthTokenURL = string(make([]byte, 257))
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid oauth_token_url",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.OAuthTokenURL = "invalid"
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid grant_type",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.GrantType = ""
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "nil password credentials",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.GrantType = GrantTypePassword
				oa.CredentialsUsername = nil
				oa.CredentialsPassword = nil
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid password credentials username",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.GrantType = GrantTypePassword
				oa.CredentialsUsername = &emptyString
				oa.CredentialsPassword = &someString
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid password credentials password",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.GrantType = GrantTypePassword
				oa.CredentialsUsername = &someString
				oa.CredentialsPassword = &emptyString
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "empty password credentials",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.GrantType = GrantTypePassword
				oa.CredentialsUsername = &emptyString
				oa.CredentialsPassword = &emptyString
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "correct password credentials",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.GrantType = GrantTypePassword
				oa.CredentialsUsername = &someString
				oa.CredentialsPassword = &someString
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Nil(t, oa.IsValid())
			},
		},
		{
			name: "empty audience",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.Audiences = []string{}
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid audience",
			item: func() *OAuthOutgoingConnection {
				oa := newValidOAuthOutgoingConnection()
				oa.Audiences = []string{"https://nowhere.com", "invalid"}
				return oa
			},
			assert: func(t *testing.T, oa *OAuthOutgoingConnection) {
				require.Error(t, oa.IsValid())
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tc.assert(t, tc.item())
		})
	}
}

func TestOAuthOutgoingConnectionPreSave(t *testing.T) {
	oa := newValidOAuthOutgoingConnection()
	oa.PreSave()

	require.NotEmpty(t, oa.Id)
	require.NotZero(t, oa.CreateAt)
	require.NotZero(t, oa.UpdateAt)
}

func TestOAuthOutgoingConnectionPreUpdate(t *testing.T) {
	oa := newValidOAuthOutgoingConnection()
	oa.PreUpdate()

	require.NotZero(t, oa.UpdateAt)
}

func TestOAuthOutgoingConnectionEtag(t *testing.T) {
	oa := newValidOAuthOutgoingConnection()
	oa.PreSave()

	require.NotEmpty(t, oa.Etag())
}

func TestOAuthOutgoingConnectionSanitize(t *testing.T) {
	oa := newValidOAuthOutgoingConnection()
	oa.Sanitize()

	require.Empty(t, oa.ClientId)
	require.Empty(t, oa.ClientSecret)
}
