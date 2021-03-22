// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package resend_invitation_email

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

const ResendInvitationEmailJob = "ResendInvitationEmailJob"

type ResendInvitationEmailScheduler struct {
	App *app.App
}

func (rse *ResendInvitationEmailJobInterfaceImpl) MakeScheduler() model.Scheduler {
	return &ResendInvitationEmailScheduler{rse.App}
}

func (s *ResendInvitationEmailScheduler) Name() string {
	return ResendInvitationEmailJob + "Scheduler"
}

func (s *ResendInvitationEmailScheduler) JobType() string {
	return model.JOB_TYPE_RESEND_INVITATION_EMAIL
}

func (s *ResendInvitationEmailScheduler) Enabled(cfg *model.Config) bool {
	return *cfg.ServiceSettings.EnableEmailInvitations
}

func (s *ResendInvitationEmailScheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	t := time.Now().Add(5 * time.Second)
	return &t
}

func (s *ResendInvitationEmailScheduler) ScheduleJob(cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	// noop because we manually schedule the job in api4.inviteUsersToTeam handler
	return nil, nil
}
