// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package resend_invitation_email

import (
	"github.com/mattermost/mattermost-server/v5/app"
	ejobs "github.com/mattermost/mattermost-server/v5/einterfaces/jobs"
)

type ResendInvitationEmailJobInterfaceImpl struct {
	App *app.App
}

func init() {
	app.RegisterJobsResendInvitationEmailInterface(func(a *app.App) ejobs.ResendInvitationEmailJobInterface {
		return &ResendInvitationEmailJobInterfaceImpl{a}
	})
}
