// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// claimsProvider is an OAuth provider that also reports claims, like the
// enterprise OpenID Connect provider.
type claimsProvider struct {
	*mocks.OAuthProvider
	*mocks.OAuthClaimsProvider
}

func newClaimsProvider() *claimsProvider {
	return &claimsProvider{OAuthProvider: &mocks.OAuthProvider{}, OAuthClaimsProvider: &mocks.OAuthClaimsProvider{}}
}

func openIDAttrs(claim string) model.StringInterface {
	return model.StringInterface{model.PropertyFieldAttrOpenID: claim}
}

func TestOAuthAttributeSyncEnabled(t *testing.T) {
	th := Setup(t)
	th.ConfigStore.SetReadOnlyFF(false)
	defer th.ConfigStore.SetReadOnlyFF(true)

	licensed := func() *model.License {
		return model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "openid")
	}
	setFlag := func(on bool) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.OpenIdAttributeSync = on })
	}

	th.App.Srv().SetLicense(licensed())
	setFlag(true)

	t.Run("generic OpenID Connect with the flag on and a license", func(t *testing.T) {
		assert.True(t, th.App.oauthAttributeSyncEnabled(model.ServiceOpenid))
	})

	t.Run("other OAuth services are not sync sources", func(t *testing.T) {
		for _, service := range []string{model.ServiceGitlab, model.ServiceGoogle, model.ServiceOffice365, ""} {
			assert.False(t, th.App.oauthAttributeSyncEnabled(service), "service %q", service)
		}
	})

	t.Run("the kill switch turns it off", func(t *testing.T) {
		setFlag(false)
		defer setFlag(true)
		assert.False(t, th.App.oauthAttributeSyncEnabled(model.ServiceOpenid))
	})

	t.Run("the license must include OpenID Connect", func(t *testing.T) {
		license := licensed()
		license.Features.OpenId = new(false)
		th.App.Srv().SetLicense(license)
		defer th.App.Srv().SetLicense(licensed())
		assert.False(t, th.App.oauthAttributeSyncEnabled(model.ServiceOpenid))
	})

	t.Run("the license must be Enterprise or higher", func(t *testing.T) {
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional, "openid"))
		defer th.App.Srv().SetLicense(licensed())
		assert.False(t, th.App.oauthAttributeSyncEnabled(model.ServiceOpenid))
	})

	t.Run("no license", func(t *testing.T) {
		th.App.Srv().SetLicense(nil)
		defer th.App.Srv().SetLicense(licensed())
		assert.False(t, th.App.oauthAttributeSyncEnabled(model.ServiceOpenid))
	})
}

func TestSyncUserAttributesFromClaims(t *testing.T) {
	h := setupPropertySyncTest(t)
	userInfo := []byte(`{"sub":"subject"}`)
	const idToken = "header.payload.signature"

	_, department := h.createAttribute(model.PropertyFieldTypeText, openIDAttrs("department"))
	_, groups := h.createAttribute(model.PropertyFieldTypeMultiselect, openIDAttrs("groups"))
	_, ldapSynced := h.createAttribute(model.PropertyFieldTypeText, ldapAttrs("department"))

	expectClaims := func(provider *claimsProvider, values map[string][]string, err error) {
		provider.OAuthClaimsProvider.On("GetClaimValues", mock.Anything, einterfaces.OAuthClaimsInput{
			Service:  model.ServiceOpenid,
			UserInfo: userInfo,
			IDToken:  idToken,
			Config:   h.App.Config(),
		}, mock.MatchedBy(func(claimPaths []string) bool {
			return assert.ElementsMatch(t, []string{"department", "groups"}, claimPaths)
		})).Return(values, err).Once()
	}
	sync := func(provider einterfaces.OAuthProvider, userID string) {
		user := &model.User{Id: userID}
		h.App.syncUserAttributesFromClaims(h.Context, provider, model.ServiceOpenid, user, userInfo, idToken)
	}

	t.Run("writes the values of the linked claims", func(t *testing.T) {
		provider := newClaimsProvider()
		expectClaims(provider, map[string][]string{"department": {"Engineering"}, "groups": {"admins", "devs"}}, nil)

		sync(provider, h.BasicUser.Id)

		provider.OAuthClaimsProvider.AssertExpectations(t)
		assert.Equal(t, "Engineering", h.valueString(h.BasicUser.Id, department.ID))
		assert.ElementsMatch(t, h.optionIDs(groups.ID, "admins", "devs"), h.valueStrings(h.BasicUser.Id, groups.ID))
		assert.Nil(t, h.value(h.BasicUser.Id, ldapSynced.ID), "an attribute synced from another source is not touched")
	})

	t.Run("a claim the provider no longer sends clears its attribute", func(t *testing.T) {
		provider := newClaimsProvider()
		expectClaims(provider, map[string][]string{"groups": {"devs"}}, nil)

		sync(provider, h.BasicUser.Id)

		assert.Empty(t, h.valueString(h.BasicUser.Id, department.ID))
		assert.Equal(t, h.optionIDs(groups.ID, "devs"), h.valueStrings(h.BasicUser.Id, groups.ID))
	})

	t.Run("claims that cannot be trusted change nothing", func(t *testing.T) {
		provider := newClaimsProvider()
		expectClaims(provider, map[string][]string{"department": {"Sales"}, "groups": {"admins"}}, nil)
		sync(provider, h.BasicUser2.Id)

		provider = newClaimsProvider()
		expectClaims(provider, nil, errors.New("id token signature is invalid"))
		sync(provider, h.BasicUser2.Id)

		provider.OAuthClaimsProvider.AssertExpectations(t)
		assert.Equal(t, "Sales", h.valueString(h.BasicUser2.Id, department.ID))
		assert.Equal(t, h.optionIDs(groups.ID, "admins"), h.valueStrings(h.BasicUser2.Id, groups.ID))
	})

	t.Run("a provider that cannot report claims syncs nothing", func(t *testing.T) {
		provider := &mocks.OAuthProvider{}
		userID := model.NewId()

		sync(provider, userID)

		assert.Nil(t, h.value(userID, department.ID))
	})
}

func TestSyncUserAttributesFromClaimsWithoutLinks(t *testing.T) {
	h := setupPropertySyncTest(t)
	h.createAttribute(model.PropertyFieldTypeText, samlAttrs("department"))

	provider := newClaimsProvider()
	h.App.syncUserAttributesFromClaims(h.Context, provider, model.ServiceOpenid, h.BasicUser, []byte(`{}`), "")

	provider.OAuthClaimsProvider.AssertNotCalled(t, "GetClaimValues", mock.Anything, mock.Anything, mock.Anything)
}

// TestCompleteOAuthSyncsUserAttributes drives CompleteOAuth with a provider
// registered for OpenID Connect. It registers into the global provider
// registry, so it does not run in parallel.
func TestCompleteOAuthSyncsUserAttributes(t *testing.T) {
	h := setupPropertySyncTest(t)
	h.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise, "openid"))
	h.App.UpdateConfig(func(cfg *model.Config) {
		cfg.OpenIdSettings.Enable = new(true)
		cfg.OpenIdSettings.Scope = new(OpenIDScope)
		cfg.FeatureFlags.OpenIdAttributeSync = true
	})
	_, department := h.createAttribute(model.PropertyFieldTypeText, openIDAttrs("department"))

	user := h.BasicUser
	_, appErr := h.App.UpdateUserAuth(h.Context, user.Id, &model.UserAuth{AuthService: model.ServiceOpenid, AuthData: new("subject-" + model.NewId())})
	require.Nil(t, appErr)
	user, appErr = h.App.GetUser(h.Context, user.Id)
	require.Nil(t, appErr)

	userInfo, err := json.Marshal(map[string]string{"sub": *user.AuthData})
	require.NoError(t, err)

	provider := newClaimsProvider()
	provider.OAuthProvider.On("GetSSOSettings", mock.Anything, mock.Anything, model.ServiceOpenid).Return(&model.SSOSettings{}, nil)
	provider.OAuthProvider.On("GetUserFromJSON", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(&model.User{
		AuthData:  user.AuthData,
		Email:     user.Email,
		Username:  user.Username,
		FirstName: user.FirstName,
		LastName:  user.LastName,
	}, nil)
	provider.OAuthClaimsProvider.On("GetClaimValues", mock.Anything, mock.MatchedBy(func(in einterfaces.OAuthClaimsInput) bool {
		return in.IDToken == "the-id-token" && bytes.Equal(in.UserInfo, userInfo)
	}), []string{"department"}).Return(map[string][]string{"department": {"Engineering"}}, nil)

	previous := einterfaces.GetOAuthProvider(model.ServiceOpenid)
	einterfaces.RegisterOAuthProvider(model.ServiceOpenid, provider)
	defer einterfaces.RegisterOAuthProvider(model.ServiceOpenid, previous)

	complete := func(action string) *model.User {
		completed, appErr := h.App.CompleteOAuth(h.Context, model.ServiceOpenid, &OAuthAuthorization{
			UserInfo: io.NopCloser(bytes.NewReader(userInfo)),
			IDToken:  "the-id-token",
		}, map[string]string{"action": action})
		require.Nil(t, appErr)
		require.Equal(t, user.Id, completed.Id)
		return completed
	}

	t.Run("sign-in syncs the user's attributes before the session exists", func(t *testing.T) {
		complete(model.OAuthActionLogin)
		assert.Equal(t, "Engineering", h.valueString(user.Id, department.ID))
	})

	t.Run("switching from OpenID Connect to email does not sync", func(t *testing.T) {
		provider.OAuthClaimsProvider.Calls = nil
		complete(model.OAuthActionSSOToEmail)
		provider.OAuthClaimsProvider.AssertNotCalled(t, "GetClaimValues", mock.Anything, mock.Anything, mock.Anything)
	})
}
