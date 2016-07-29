// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import "testing"

func TestWebrtcToken(t *testing.T) {
	th := Setup().InitBasic()

	if _, err := th.BasicClient.GetWebrtcToken(); err != nil {
		if err.Id != "api.webrtc.not_available.app_error" {
			t.Fatal("Should have fail, webrtc not availble")
		}
	} else {
		t.Fatal("Should have fail, webrtc not availble")
	}
}
