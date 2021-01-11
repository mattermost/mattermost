// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filesstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestCheckMandatoryS3Fields(t *testing.T) {
	cfg := model.FileSettings{}

	err := CheckMandatoryS3Fields(&cfg)
	require.NotNil(t, err)
	require.Equal(t, err.Error(), "missing s3 bucket settings", "should've failed with missing s3 bucket")

	cfg.AmazonS3Bucket = model.NewString("test-mm")
	err = CheckMandatoryS3Fields(&cfg)
	require.Nil(t, err)

	cfg.AmazonS3Endpoint = model.NewString("")
	err = CheckMandatoryS3Fields(&cfg)

	require.Nil(t, err)
	require.Equal(t, *cfg.AmazonS3Endpoint, "s3.amazonaws.com", "should've set the endpoint to the default")
}
