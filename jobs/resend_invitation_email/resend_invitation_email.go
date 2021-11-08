// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package resend_invitation_email

import (
	"github.com/mattermost/mattermost-server/v6/app"
	ejobs "github.com/mattermost/mattermost-server/v6/einterfaces/jobs"
)

type ResendInvitationEmailJobInterfaceImpl struct {
	App *app.App
}

func init() {
	app.RegisterJobsResendInvitationEmailInterface(func(s *app.Server) ejobs.ResendInvitationEmailJobInterface {
		a := app.New(app.ServerConnector(s))
		return &ResendInvitationEmailJobInterfaceImpl{a}
	})
}
