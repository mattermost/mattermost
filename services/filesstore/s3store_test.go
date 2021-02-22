// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filesstore

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCheckMandatoryS3Fields(t *testing.T) {
	cfg := FileBackendSettings{}

	err := cfg.CheckMandatoryS3Fields()
	require.Error(t, err)
	require.Equal(t, err.Error(), "missing s3 bucket settings", "should've failed with missing s3 bucket")

	cfg.AmazonS3Bucket = "test-mm"
	err = cfg.CheckMandatoryS3Fields()
	require.NoError(t, err)

	cfg.AmazonS3Endpoint = ""
	err = cfg.CheckMandatoryS3Fields()
	require.NoError(t, err)

	require.Equal(t, "s3.amazonaws.com", cfg.AmazonS3Endpoint, "should've set the endpoint to the default")
}
