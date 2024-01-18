package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

var (
	emptyString = ""
	someString  = "userorpass"
)

func newValidOutgoingOAuthConnection() *OutgoingOAuthConnection {
	return &OutgoingOAuthConnection{
		Id:            NewId(),
		CreatorId:     NewId(),
		Name:          "Test Connection",
		ClientId:      NewId(),
		ClientSecret:  NewId(),
		OAuthTokenURL: "https://nowhere.com/oauth/token",
		GrantType:     OutgoingOAuthConnectionGrantTypeClientCredentials,
		CreateAt:      GetMillis(),
		UpdateAt:      GetMillis(),
		Audiences:     []string{"https://nowhere.com"},
	}
}

func TestOutgoingOAuthConnectionIsValid(t *testing.T) {
	var cases = []struct {
		name   string
		item   func() *OutgoingOAuthConnection
		assert func(t *testing.T, oa *OutgoingOAuthConnection)
	}{
		{
			name: "valid",
			item: func() *OutgoingOAuthConnection {
				return newValidOutgoingOAuthConnection()
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Nil(t, oa.IsValid())
			},
		},
		{
			name: "invalid id",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.Id = ""
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "empty name",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.Name = ""
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid create_at",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.CreateAt = 0
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid update_at",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.UpdateAt = 0
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid creator_id",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.CreatorId = ""
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid name",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.Name = ""
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid client_id",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.ClientId = ""
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "long client_id",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.ClientId = string(make([]byte, 257))
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid client_secret",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.ClientSecret = ""
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "long client_secret",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.ClientSecret = string(make([]byte, 257))
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "empty oauth_token_url",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.OAuthTokenURL = ""
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "long oauth_token_url",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.OAuthTokenURL = string(make([]byte, 257))
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid oauth_token_url",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.OAuthTokenURL = "invalid"
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid grant_type",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.GrantType = ""
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "nil password credentials",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.GrantType = OutgoingOAuthConnectionGrantTypePassword
				oa.CredentialsUsername = nil
				oa.CredentialsPassword = nil
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid password credentials username",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.GrantType = OutgoingOAuthConnectionGrantTypePassword
				oa.CredentialsUsername = &emptyString
				oa.CredentialsPassword = &someString
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid password credentials password",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.GrantType = OutgoingOAuthConnectionGrantTypePassword
				oa.CredentialsUsername = &someString
				oa.CredentialsPassword = &emptyString
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "empty password credentials",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.GrantType = OutgoingOAuthConnectionGrantTypePassword
				oa.CredentialsUsername = &emptyString
				oa.CredentialsPassword = &emptyString
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "correct password credentials",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.GrantType = OutgoingOAuthConnectionGrantTypePassword
				oa.CredentialsUsername = &someString
				oa.CredentialsPassword = &someString
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Nil(t, oa.IsValid())
			},
		},
		{
			name: "empty audience",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.Audiences = []string{}
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
				require.Error(t, oa.IsValid())
			},
		},
		{
			name: "invalid audience",
			item: func() *OutgoingOAuthConnection {
				oa := newValidOutgoingOAuthConnection()
				oa.Audiences = []string{"https://nowhere.com", "invalid"}
				return oa
			},
			assert: func(t *testing.T, oa *OutgoingOAuthConnection) {
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

func TestOutgoingOAuthConnectionPreSave(t *testing.T) {
	oa := newValidOutgoingOAuthConnection()
	oa.PreSave()

	require.NotEmpty(t, oa.Id)
	require.NotZero(t, oa.CreateAt)
	require.NotZero(t, oa.UpdateAt)
}

func TestOutgoingOAuthConnectionPreUpdate(t *testing.T) {
	oa := newValidOutgoingOAuthConnection()
	oa.PreUpdate()

	require.NotZero(t, oa.UpdateAt)
}

func TestOutgoingOAuthConnectionEtag(t *testing.T) {
	oa := newValidOutgoingOAuthConnection()
	oa.PreSave()

	require.NotEmpty(t, oa.Etag())
}

func TestOutgoingOAuthConnectionSanitize(t *testing.T) {
	oa := newValidOutgoingOAuthConnection()
	oa.Sanitize()

	require.Empty(t, oa.ClientId)
	require.Empty(t, oa.ClientSecret)
	require.Empty(t, oa.CredentialsUsername)
	require.Empty(t, oa.CredentialsPassword)
}
