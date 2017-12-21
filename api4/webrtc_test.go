// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"

	"github.com/mattermost/mattermost-server/model"
)

func TestGetWebrtcToken(t *testing.T) {
	if testing.Short() {
		t.SkipNow()
	}

	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()
	Client := th.Client

	enableWebrtc := *th.App.Config().WebrtcSettings.Enable
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.WebrtcSettings.Enable = enableWebrtc })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.WebrtcSettings.Enable = false })

	_, resp := Client.GetWebrtcToken()
	CheckNotImplementedStatus(t, resp)

	Client.Logout()
	_, resp = Client.GetWebrtcToken()
	CheckUnauthorizedStatus(t, resp)
}
