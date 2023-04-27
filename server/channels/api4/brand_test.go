// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/v8/channels/utils/testutils"
)

func TestGetBrandImage(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	_, resp, err := client.GetBrandImage()
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	client.Logout()
	_, resp, err = client.GetBrandImage()
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = th.SystemAdminClient.GetBrandImage()
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestUploadBrandImage(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	resp, err := client.UploadBrandImage(data)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// status code returns either forbidden or unauthorized
	// note: forbidden is set as default at Client4.SetProfileImage when request is terminated early by server
	client.Logout()
	resp, err = client.UploadBrandImage(data)
	require.Error(t, err)
	if resp.StatusCode == http.StatusForbidden {
		CheckForbiddenStatus(t, resp)
	} else if resp.StatusCode == http.StatusUnauthorized {
		CheckUnauthorizedStatus(t, resp)
	} else {
		require.Fail(t, "Should have failed either forbidden or unauthorized")
	}

	resp, err = th.SystemAdminClient.UploadBrandImage(data)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
}

func TestDeleteBrandImage(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	resp, err := th.SystemAdminClient.UploadBrandImage(data)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	resp, err = th.Client.DeleteBrandImage()
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()

	resp, err = th.Client.DeleteBrandImage()
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	resp, err = th.SystemAdminClient.DeleteBrandImage()
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	resp, err = th.SystemAdminClient.DeleteBrandImage()
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}
