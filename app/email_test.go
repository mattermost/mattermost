// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCondenseSiteURL(t *testing.T) {
	require.Equal(t, "", condenseSiteURL(""))
	require.Equal(t, "mattermost.com", condenseSiteURL("mattermost.com"))
	require.Equal(t, "mattermost.com", condenseSiteURL("mattermost.com/"))
	require.Equal(t, "chat.mattermost.com", condenseSiteURL("chat.mattermost.com"))
	require.Equal(t, "chat.mattermost.com", condenseSiteURL("chat.mattermost.com/"))
	require.Equal(t, "mattermost.com/subpath", condenseSiteURL("mattermost.com/subpath"))
	require.Equal(t, "mattermost.com/subpath", condenseSiteURL("mattermost.com/subpath/"))
	require.Equal(t, "chat.mattermost.com/subpath", condenseSiteURL("chat.mattermost.com/subpath"))
	require.Equal(t, "chat.mattermost.com/subpath", condenseSiteURL("chat.mattermost.com/subpath/"))

	require.Equal(t, "mattermost.com:8080", condenseSiteURL("http://mattermost.com:8080"))
	require.Equal(t, "mattermost.com:8080", condenseSiteURL("http://mattermost.com:8080/"))
	require.Equal(t, "chat.mattermost.com:8080", condenseSiteURL("http://chat.mattermost.com:8080"))
	require.Equal(t, "chat.mattermost.com:8080", condenseSiteURL("http://chat.mattermost.com:8080/"))
	require.Equal(t, "mattermost.com:8080/subpath", condenseSiteURL("http://mattermost.com:8080/subpath"))
	require.Equal(t, "mattermost.com:8080/subpath", condenseSiteURL("http://mattermost.com:8080/subpath/"))
	require.Equal(t, "chat.mattermost.com:8080/subpath", condenseSiteURL("http://chat.mattermost.com:8080/subpath"))
	require.Equal(t, "chat.mattermost.com:8080/subpath", condenseSiteURL("http://chat.mattermost.com:8080/subpath/"))
}
