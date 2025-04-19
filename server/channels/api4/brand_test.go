// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func TestGetBrandImage(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	_, resp, err := client.GetBrandImage(context.Background())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	_, resp, err = client.GetBrandImage(context.Background())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, resp, err = th.SystemAdminClient.GetBrandImage(context.Background())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestUploadBrandImage(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()
	client := th.Client

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	resp, err := client.UploadBrandImage(context.Background(), data)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	// status code returns either forbidden or unauthorized
	// note: forbidden is set as default at Client4.SetProfileImage when request is terminated early by server
	_, err = client.Logout(context.Background())
	require.NoError(t, err)
	resp, err = client.UploadBrandImage(context.Background(), data)
	require.Error(t, err)
	if resp.StatusCode == http.StatusForbidden {
		CheckForbiddenStatus(t, resp)
	} else if resp.StatusCode == http.StatusUnauthorized {
		CheckUnauthorizedStatus(t, resp)
	} else {
		require.Fail(t, "Should have failed either forbidden or unauthorized")
	}

	resp, err = th.SystemAdminClient.UploadBrandImage(context.Background(), data)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
}

func TestUploadBrandImageTwice(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	// First upload as system admin
	resp, err := th.SystemAdminClient.UploadBrandImage(context.Background(), data)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	// Verify the image exists and contents match what was uploaded
	receivedImg, resp, err := th.SystemAdminClient.GetBrandImage(context.Background())
	require.NoError(t, err)
	require.NotNil(t, receivedImg)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.NotEmpty(t, receivedImg, "Received image data should not be empty")

	// Get the list of files in the brand directory
	files, err := th.App.FileBackend().ListDirectory("brand/")
	require.NoError(t, err)
	require.Len(t, files, 1, "Expected only the original image file")

	// ListDirectory returns paths with the directory prefix included
	fileName := files[0]
	fileName = strings.TrimPrefix(fileName, "brand/")
	require.Equal(t, "image.png", fileName, "Expected the original image file")

	// Second upload (which should back up the previous one)
	data2, err := testutils.ReadTestFile("test.tiff")
	require.NoError(t, err)

	resp, err = th.SystemAdminClient.UploadBrandImage(context.Background(), data2)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	// Get the list of files in the brand directory again
	files, err = th.App.FileBackend().ListDirectory("brand/")
	require.NoError(t, err)

	// Should now have the new image.png and a backup with timestamp
	require.Len(t, files, 2, "Expected the original and backup files")

	// Check that one of the files is image.png
	hasOriginal := false
	hasBackup := false
	for _, file := range files {
		// ListDirectory returns paths with the directory prefix included
		fileName := strings.TrimPrefix(file, "brand/")

		if fileName == "image.png" {
			hasOriginal = true
		} else if strings.HasSuffix(fileName, ".png") && strings.Contains(fileName, "-") {
			// Backup file should have a timestamp format like 2006-01-02T15:04:05.png
			hasBackup = true
		}
	}

	require.True(t, hasOriginal, "Original image.png file should exist")
	require.True(t, hasBackup, "Backup image file should exist")

	// Verify the new image is available through the API and matches what was uploaded
	receivedImg2, resp, err := th.SystemAdminClient.GetBrandImage(context.Background())
	require.NoError(t, err)
	require.NotNil(t, receivedImg2)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.NotEmpty(t, receivedImg2, "Received image data should not be empty")
}

func TestDeleteBrandImage(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	resp, err := th.SystemAdminClient.UploadBrandImage(context.Background(), data)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	resp, err = th.Client.DeleteBrandImage(context.Background())
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, err = th.Client.Logout(context.Background())
	require.NoError(t, err)

	resp, err = th.Client.DeleteBrandImage(context.Background())
	require.Error(t, err)
	CheckUnauthorizedStatus(t, resp)

	resp, err = th.SystemAdminClient.DeleteBrandImage(context.Background())
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	resp, err = th.SystemAdminClient.DeleteBrandImage(context.Background())
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}
