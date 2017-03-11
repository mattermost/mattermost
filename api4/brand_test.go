// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"
)

func TestGetBrandImage(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	data, resp := Client.GetBrandImage()
	CheckNoError(t, resp)

	if len(data) != 0 {
		t.Fatal("no image uploaded - should be empty")
	}

	Client.Logout()
	data, resp = Client.GetBrandImage()
	CheckNoError(t, resp)

	if len(data) != 0 {
		t.Fatal("no image uploaded - should be empty")
	}

	data, resp = th.SystemAdminClient.GetBrandImage()
	CheckNoError(t, resp)

	if len(data) != 0 {
		t.Fatal("no image uploaded - should be empty")
	}
}

func TestUploadBrandImage(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer TearDown()
	Client := th.Client

	data, err := readTestFile("test.png")
	if err != nil {
		t.Fatal(err)
	}

	ok, resp := Client.UploadBrandImage(data)
	CheckForbiddenStatus(t, resp)
	if ok {
		t.Fatal("Should return false, set brand image not allowed")
	}

	Client.Logout()
	_, resp = Client.UploadBrandImage(data)
	CheckUnauthorizedStatus(t, resp)

	_, resp = th.SystemAdminClient.UploadBrandImage(data)
	CheckNotImplementedStatus(t, resp)
}
