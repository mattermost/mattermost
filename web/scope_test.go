// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"sort"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestScopes(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup(t).InitBasic()
	defer th.TearDown()

	// This test verifies that each API is assigned correct scopes. It needs to
	// be updated when APIs are added/removed, or change their scope
	// requirements.
	t.Run("required scopes by endpoint name", func(t *testing.T) {
		expected := map[string]model.APIScopes{
			"authorizeOAuthApp":    {model.ScopeOAuth2Manage},
			"authorizeOAuthPage":   model.ScopeUnrestrictedAPI,
			"commandWebhook":       model.ScopeUnrestrictedAPI,
			"completeOAuth":        model.ScopeUnrestrictedAPI,
			"completeSaml":         model.ScopeUnrestrictedAPI,
			"deauthorizeOAuthApp":  {model.ScopeOAuth2Manage},
			"getAccessToken":       model.ScopeUnrestrictedAPI,
			"incomingWebhook":      model.ScopeUnrestrictedAPI,
			"loginWithOAuth":       model.ScopeUnrestrictedAPI,
			"loginWithSaml":        model.ScopeUnrestrictedAPI,
			"mobileLoginWithOAuth": model.ScopeUnrestrictedAPI,
			"root":                 model.ScopeUnrestrictedAPI,
			"signupWithOAuth":      model.ScopeUnrestrictedAPI,
			"testHandler":          {model.ScopeOAuth2Manage},
		}

		expectedKeys := []string{}
		for k := range expected {
			expectedKeys = append(expectedKeys, k)
		}
		sort.Strings(expectedKeys)
		keys := []string{}
		for k := range th.Web.knownEndpointsByName {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		require.EqualValues(t, expectedKeys, keys)
		require.EqualValues(t, expected, th.Web.knownEndpointsByName)
	})

	// This test verifies that each API is assigned correct scopes. It needs to
	// be updated when APIs are added/removed, or change their scope
	// requirements.
	t.Run("endpoints by scope name", func(t *testing.T) {
		expected := map[model.Scope][]string{
			"*:*":           {"authorizeOAuthPage", "commandWebhook", "completeOAuth", "completeSaml", "getAccessToken", "incomingWebhook", "loginWithOAuth", "loginWithSaml", "mobileLoginWithOAuth", "root", "signupWithOAuth"},
			"oauth2:manage": {"authorizeOAuthApp", "deauthorizeOAuthApp", "testHandler"},
		}

		normalize := func(v map[model.Scope][]string) map[model.Scope][]string {
			for k := range v {
				sort.Slice(v[k], func(i, j int) bool { return v[k][i] < v[k][j] })
			}
			return v
		}

		require.EqualValues(t, normalize(expected), normalize(th.Web.knownEndpointsByScope))
	})
}
