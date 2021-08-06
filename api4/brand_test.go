// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/utils/testutils"
)

func TestGetBrandImage(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	_, resp, _ := client.GetBrandImage()
	CheckNotFoundStatus(t, resp)

	client.Logout()
	_, resp, _ = client.GetBrandImage()
	CheckNotFoundStatus(t, resp)

	_, resp, _ = th.SystemAdminClient.GetBrandImage()
	CheckNotFoundStatus(t, resp)
}

func TestUploadBrandImage(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	_, resp, _ := client.UploadBrandImage(data)
	CheckForbiddenStatus(t, resp)

	// status code returns either forbidden or unauthorized
	// note: forbidden is set as default at Client4.SetProfileImage when request is terminated early by server
	client.Logout()
	_, resp, _ = client.UploadBrandImage(data)
	if resp.StatusCode == http.StatusForbidden {
		CheckForbiddenStatus(t, resp)
	} else if resp.StatusCode == http.StatusUnauthorized {
		CheckUnauthorizedStatus(t, resp)
	} else {
		require.Fail(t, "Should have failed either forbidden or unauthorized")
	}

	_, resp, _ = th.SystemAdminClient.UploadBrandImage(data)
	CheckCreatedStatus(t, resp)
}

func TestDeleteBrandImage(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	_, resp, _ := th.SystemAdminClient.UploadBrandImage(data)
	CheckCreatedStatus(t, resp)

	resp, _ = th.Client.DeleteBrandImage()
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()

	resp, _ = th.Client.DeleteBrandImage()
	CheckUnauthorizedStatus(t, resp)

	resp, _ = th.SystemAdminClient.DeleteBrandImage()
	CheckOKStatus(t, resp)

	resp, _ = th.SystemAdminClient.DeleteBrandImage()
	CheckNotFoundStatus(t, resp)
}
