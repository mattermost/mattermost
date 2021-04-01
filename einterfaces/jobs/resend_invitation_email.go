// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package jobs

import "github.com/mattermost/mattermost-server/v5/model"

// ResendInvitationEmailJobInterface defines the interface for the job to resend invitation emails
type ResendInvitationEmailJobInterface interface {
	MakeWorker() model.Worker
	MakeScheduler() model.Scheduler
}
