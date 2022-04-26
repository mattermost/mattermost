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
	if !*s.Config().EmailSettings.EnableInactivityEmail {
		mlog.Info("No activity check because EnableInactivityEmail is false")
		return
	}

	if !s.Config().FeatureFlags.EnableInactivityCheckJob {
		mlog.Info("No activity check because EnableInactivityCheckJob feature flag is disabled")
		return
	}

	inactivityDurationHoursEnv := os.Getenv("MM_INACTIVITY_DURATION")
	inactivityDurationHours, parseError := strconv.ParseFloat(inactivityDurationHoursEnv, 64)
	if parseError != nil {
		// default to 100 hours
		inactivityDurationHours = serverInactivityHours
	}

	systemValue, sysValErr := s.Store.System().GetByName("INACTIVITY")
	if sysValErr != nil {
		// any other error apart from ErrNotFound we stop execution
		if _, ok := sysValErr.(*store.ErrNotFound); !ok {
			mlog.Warn("An error occurred while getting INACTIVITY from system store", mlog.Err(sysValErr))
			return
		}
	}

	// If we have a system value, it means this job already ran atleast once.
	// we then check the last time the job ran plus the last time a post was made to determine if we
	// can remind the user to use workspace again. If no post was made, we check the last time they logged in (session)
	// and determine whether to send them a reminder.
	if systemValue != nil {
		sysT, _ := strconv.ParseInt(systemValue.Value, 10, 64)
		tt := time.Unix(sysT/1000, 0)
		timeLastSentInactivityEmail := time.Since(tt).Hours()

		lastPostAt, _ := s.Store.Post().GetLastPostRowCreateAt()
		if lastPostAt != 0 {
			posT := time.Unix(lastPostAt/1000, 0)
			timeForLastPost := time.Since(posT).Hours()

			if timeLastSentInactivityEmail > inactivityDurationHours && timeForLastPost > inactivityDurationHours {
				s.takeInactivityAction()
			}
			return
		}

		lastSessionAt, _ := s.Store.Session().GetLastSessionRowCreateAt()
		if lastSessionAt != 0 {
			sesT := time.Unix(lastSessionAt/1000, 0)
			timeForLastSession := time.Since(sesT).Hours()

			if timeLastSentInactivityEmail > inactivityDurationHours && timeForLastSession > inactivityDurationHours {
				s.takeInactivityAction()
			}
			return
		}
	}

	// The first time this job runs. We check if the user has not made any posts
	// and remind them to use the workspace. If no posts have been made. We check the last time
	// they logged in (session) and send a reminder.

	lastPostAt, _ := s.Store.Post().GetLastPostRowCreateAt()
	if lastPostAt != 0 {
		posT := time.Unix(lastPostAt/1000, 0)
		timeForLastPost := time.Since(posT).Hours()
		if timeForLastPost > inactivityDurationHours {
			s.takeInactivityAction()
		}
		return
	}

	lastSessionAt, _ := s.Store.Session().GetLastSessionRowCreateAt()
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
	siteURL := *s.Config().ServiceSettings.SiteURL
	if siteURL == "" {
		mlog.Warn("No SiteURL configured")
	}

	properties := map[string]interface{}{
		"SiteURL": siteURL,
	}
	s.GetTelemetryService().SendTelemetry("inactive_server", properties)
	users, err := s.Store.User().GetSystemAdminProfiles()
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

	// Mark time that we sent emails. The next time we calculate
	sysVar := &model.System{Name: "INACTIVITY", Value: fmt.Sprint(model.GetMillis())}
	if err := s.Store.System().SaveOrUpdate(sysVar); err != nil {
		mlog.Error("Unable to save INACTIVITY", mlog.Err(err))
	}

	// do some telemetry about sending the email
	s.GetTelemetryService().SendTelemetry("inactive_server_emails_sent", properties)
}
