// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package filesstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/require"
)

func TestCheckMandatoryS3Fields(t *testing.T) {
	cfg := model.FileSettings{}

	err := CheckMandatoryS3Fields(&cfg)
	res := err == nil || err.Message != "api.admin.test_s3.missing_s3_bucket"
	require.False(t, res, "should've failed with missing s3 bucket")

	cfg.AmazonS3Bucket = model.NewString("test-mm")
	err = CheckMandatoryS3Fields(&cfg)
	require.Nil(t, err, "should've not failed")

	cfg.AmazonS3Endpoint = model.NewString("")
	err = CheckMandatoryS3Fields(&cfg)

	res = err != nil || *cfg.AmazonS3Endpoint != "s3.amazonaws.com"
	require.False(t, res, "should've not failed because it should set the endpoint to the default")

}
