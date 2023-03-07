// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/server/v7/model"
	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

const serverInactivityHours = 100
const inactivityEmailSent = "INACTIVITY"

func (s *Server) doInactivityCheck() {

	if *s.platform.Config().ServiceSettings.EnableDeveloper {
		mlog.Info("No activity check because developer mode is enabled")
		return
	}

	if !*s.platform.Config().EmailSettings.EnableInactivityEmail {
		mlog.Info("No activity check because EnableInactivityEmail is false")
		return
	}

	if !s.platform.Config().FeatureFlags.EnableInactivityCheckJob {
		mlog.Info("No activity check because EnableInactivityCheckJob feature flag is disabled")
		return
	}

	_, sysValErr := s.Store().System().GetByName(inactivityEmailSent)
	// if there is no error which may include *store.ErrNotFound, it means this check was already flagged as done
	if sysValErr == nil {
		return
	}

	inactivityDurationHoursEnv := os.Getenv("MM_INACTIVITY_DURATION")
	inactivityDurationHours, parseError := strconv.ParseFloat(inactivityDurationHoursEnv, 64)
	if parseError != nil {
		// default to 100 hours
		inactivityDurationHours = serverInactivityHours
	}

	// The first time this job runs. We check if the user has not made any posts in last inactivityDurationHours
	// and remind them to use the workspace. If no posts have been made. We check the last time
	// they logged in (session) for the last inactivityDurationHours and send a reminder.
	lastPostAt, _ := s.Store().Post().GetLastPostRowCreateAt()
	if lastPostAt != 0 {
		posT := time.Unix(lastPostAt/1000, 0)
		timeForLastPost := time.Since(posT).Hours()
		if timeForLastPost > inactivityDurationHours {
			s.takeInactivityAction()
		}
		return
	}

	lastSessionAt, _ := s.Store().Session().GetLastSessionRowCreateAt()
	if lastSessionAt != 0 {
		sesT := time.Unix(lastSessionAt/1000, 0)
		timeForLastSession := time.Since(sesT).Hours()
		if timeForLastSession > inactivityDurationHours {
			s.takeInactivityAction()
		}
		return
	}
}

func (s *Server) takeInactivityAction() {
	siteURL := *s.platform.Config().ServiceSettings.SiteURL
	if siteURL == "" {
		mlog.Warn("No SiteURL configured")
	}

	properties := map[string]any{
		"SiteURL": siteURL,
	}
	s.GetTelemetryService().SendTelemetry("inactive_server", properties)
	users, err := s.Store().User().GetSystemAdminProfiles()
	if err != nil {
		mlog.Error("Failed to get system admins for inactivity check from Mattermost.")
		return
	}

	for _, user := range users {

		// See https://go.dev/doc/faq#closures_and_goroutines for why we make this assignment
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

	// Mark that we sent emails.
	sysVar := &model.System{Name: inactivityEmailSent, Value: "true"}
	if err := s.Store().System().SaveOrUpdate(sysVar); err != nil {
		mlog.Error("Unable to save INACTIVITY", mlog.Err(err))
	}

	// do some telemetry about sending the email
	s.GetTelemetryService().SendTelemetry("inactive_server_emails_sent", properties)
}
