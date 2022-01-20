// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

const serverInactivityHours = 100

func (s *Server) doInactivityCheck() {
	inactivityDurationHourseEnv := os.Getenv("MM_INACTIVITY_DURATION")
	inactivityDurationHours, parseError := strconv.ParseFloat(inactivityDurationHourseEnv, 64)
	if parseError != nil {
		// default to 100 hours
		inactivityDurationHours = serverInactivityHours
	}

	systemValue, sysValErr := s.Store.System().GetByName("INACTIVITY")
	if sysValErr != nil {
		if _, ok := sysValErr.(*store.ErrNotFound); !ok {
			mlog.Error("An error occurred while getting INACTIVITY from system store", mlog.Err(sysValErr))
		}
	}

	post, _ := s.Store.Post().GetLastPostRow()
	session, _ := s.Store.Session().GetLastSessionRow()

	// If we have a system value, it means this job already ran atleast once.
	// we then check the last time the job ran plus the last time a post was made to determine if we
	// can remind the user to use workspace again. If no post was made, we check the last time they logged in (session)
	// and determine whether to send them a reminder.
	if systemValue != nil {
		sysT, _ := strconv.ParseInt(systemValue.Value, 10, 64)
		tt := time.Unix(int64(sysT/1000), 0)
		timeLastSentInativityEmail := time.Since(tt).Hours()

		if post != nil {
			lastPostAt := post.CreateAt
			posT := time.Unix(lastPostAt/1000, 0)
			timeForLastPost := time.Since(posT).Hours()

			if timeLastSentInativityEmail > inactivityDurationHours && timeForLastPost > inactivityDurationHours {
				s.takeInactivityAction()
			}
			return
		}

		if session != nil {
			lastSessionAt := session.CreateAt
			sesT := time.Unix(lastSessionAt/1000, 0)
			timeForLastSession := time.Since(sesT).Hours()

			if timeLastSentInativityEmail > inactivityDurationHours && timeForLastSession > inactivityDurationHours {
				s.takeInactivityAction()
			}
			return
		}
	}

	// The first time this job runs. We check if the user has not made any posts
	// and remind them to use the workspace. If no posts have been made. We check the last time
	// they logged in (session) and send a reminder.

	if post != nil {
		lastPostAt := post.CreateAt
		posT := time.Unix(lastPostAt/1000, 0)
		timeForLastPost := time.Since(posT).Hours()
		if timeForLastPost > inactivityDurationHours {
			s.takeInactivityAction()
		}
		return
	}

	if session != nil {
		lastSessionAt := session.CreateAt
		sesT := time.Unix(lastSessionAt/1000, 0)
		timeForLastSession := time.Since(sesT).Hours()
		if timeForLastSession > inactivityDurationHours {
			s.takeInactivityAction()
		}
		return
	}
}

func (s *Server) takeInactivityAction() {
	siteURL := *s.Config().ServiceSettings.SiteURL
	properties := map[string]interface{}{
		"SiteURL": siteURL,
	}
	s.GetTelemetryService().SendTelemetry("inactive_server", properties)
	users, err := s.Store.User().GetSystemAdminProfiles()
	if err != nil {
		mlog.Error("Failed to get system admins for license expired message from Mattermost.")
		return
	}

	for _, user := range users {
		user := user
		if user.Email == "" {
			mlog.Error("Invalid system admin email.", mlog.String("user_email", user.Email))
			continue
		}

		name := user.FirstName
		if name == "" {
			name = user.Username
		}

		mlog.Debug("Sending inactivity reminder email.", mlog.String("user_email", user.Email))
		s.Go(func() {
			if err := s.EmailService.SendLicenseInactivityEmail(user.Email, name, user.Locale, siteURL); err != nil {
				mlog.Error("Error while sending inactivity reminder email.", mlog.String("user_email", user.Email), mlog.Err(err))
			}
		})
	}

	// Mark time that we sent emails. The next time we calculate
	sysVar := &model.System{Name: "INACTIVITY", Value: fmt.Sprint(model.GetMillis())}
	if err := s.Store.System().SaveOrUpdate(sysVar); err != nil {
		mlog.Error("Unable to save INACTIVITY", mlog.Err(err))
	}

	// do some telemetry about sending the email
	s.GetTelemetryService().SendTelemetry("inactive_server_emails_sent", properties)
}
