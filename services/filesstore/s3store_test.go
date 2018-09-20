// Copyright (c) 2018-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package filesstore

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestCheckMandatoryS3Fields(t *testing.T) {
	cfg := model.FileSettings{}

	err := CheckMandatoryS3Fields(&cfg)
	if err == nil || err.Message != "api.admin.test_s3.missing_s3_bucket" {
		t.Fatal("should've failed with missing s3 bucket")
	}

	cfg.AmazonS3Bucket = "test-mm"
	err = CheckMandatoryS3Fields(&cfg)
	if err != nil {
		t.Fatal("should've not failed")
	}

	cfg.AmazonS3Endpoint = ""
	err = CheckMandatoryS3Fields(&cfg)
	if err != nil || cfg.AmazonS3Endpoint != "s3.amazonaws.com" {
		t.Fatal("should've not failed because it should set the endpoint to the default")
	}

}
