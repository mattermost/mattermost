// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/utils/testutils"
)

func TestGetBrandImage(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	Client := th.Client

	_, resp := Client.GetBrandImage()
	CheckNotFoundStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetBrandImage()
	CheckNotFoundStatus(t, resp)

	_, resp = th.SystemAdminClient.GetBrandImage()
	CheckNotFoundStatus(t, resp)
}

func TestUploadBrandImage(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	Client := th.Client

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	_, resp := Client.UploadBrandImage(data)
	CheckForbiddenStatus(t, resp)

	// status code returns either forbidden or unauthorized
	// note: forbidden is set as default at Client4.SetProfileImage when request is terminated early by server
	Client.Logout()
	_, resp = Client.UploadBrandImage(data)
	if resp.StatusCode == http.StatusForbidden {
		CheckForbiddenStatus(t, resp)
	} else if resp.StatusCode == http.StatusUnauthorized {
		CheckUnauthorizedStatus(t, resp)
	} else {
		require.Fail(t, "Should have failed either forbidden or unauthorized")
	}

	_, resp = th.SystemAdminClient.UploadBrandImage(data)
	CheckCreatedStatus(t, resp)
}

func TestDeleteBrandImage(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	_, resp := th.SystemAdminClient.UploadBrandImage(data)
	CheckCreatedStatus(t, resp)

	resp = th.Client.DeleteBrandImage()
	CheckForbiddenStatus(t, resp)

	th.Client.Logout()

	resp = th.Client.DeleteBrandImage()
	CheckUnauthorizedStatus(t, resp)

	resp = th.SystemAdminClient.DeleteBrandImage()
	CheckOKStatus(t, resp)

	resp = th.SystemAdminClient.DeleteBrandImage()
	CheckNotFoundStatus(t, resp)
}
