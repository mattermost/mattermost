// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import "testing"

import "github.com/stretchr/testify/require"

func TestFingerprintStableValue(t *testing.T) {
	t.Parallel()

	require.Equal(t, "d6d75784864136ece5c223dc01827be2", Fingerprint("PUSH_EMPTY_URL", "ServiceSettings.SiteURL", ""))
	require.Equal(t, "d6d75784864136ece5c223dc01827be2", Fingerprint("PUSH_EMPTY_URL", "ServiceSettings.SiteURL", ""))
}

func TestFingerprintSeparatesDimensions(t *testing.T) {
	t.Parallel()

	base := Fingerprint("PUSH_EMPTY_URL", "ServiceSettings.SiteURL", "")
	require.NotEqual(t, base, Fingerprint("PUSH_BAD_SCHEME", "ServiceSettings.SiteURL", ""))
	require.NotEqual(t, base, Fingerprint("PUSH_EMPTY_URL", "ServiceSettings.EnableUserAccessTokens", ""))
	require.NotEqual(t, base, Fingerprint("PUSH_EMPTY_URL", "ServiceSettings.SiteURL", "node-1"))
}
