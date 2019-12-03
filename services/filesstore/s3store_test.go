// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filesstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestCheckMandatoryS3Fields(t *testing.T) {
	cfg := model.FileSettings{}

	err := CheckMandatoryS3Fields(&cfg)
	require.NotNil(t, err)
	require.Equal(t, err.Message, "api.admin.test_s3.missing_s3_bucket", "should've failed with missing s3 bucket")

	cfg.AmazonS3Bucket = model.NewString("test-mm")
	err = CheckMandatoryS3Fields(&cfg)
	require.Nil(t, err)

	cfg.AmazonS3Endpoint = model.NewString("")
	err = CheckMandatoryS3Fields(&cfg)

	require.Nil(t, err)
	require.Equal(t, *cfg.AmazonS3Endpoint, "s3.amazonaws.com", "should've set the endpoint to the default")
}
