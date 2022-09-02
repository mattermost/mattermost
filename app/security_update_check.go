// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"runtime"
	"strconv"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mail"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	PropSecurityURL      = "https://securityupdatecheck.mattermost.com"
	SecurityUpdatePeriod = 86400000 // 24 hours in milliseconds.

	PropSecurityID              = "id"
	PropSecurityBuild           = "b"
	PropSecurityEnterpriseReady = "be"
	PropSecurityDatabase        = "db"
	PropSecurityOS              = "os"
	PropSecurityUserCount       = "uc"
	PropSecurityTeamCount       = "tc"
	PropSecurityActiveUserCount = "auc"
	PropSecurityUnitTests       = "ut"
)

func (s *Server) DoSecurityUpdateCheck() {
	if !*s.platform.Config().ServiceSettings.EnableSecurityFixAlert {
		return
	}

	props, err := s.Store().System().Get()
	if err != nil {
		return
	}

	lastSecurityTime, _ := strconv.ParseInt(props[model.SystemLastSecurityTime], 10, 0)
	currentTime := model.GetMillis()

	if (currentTime - lastSecurityTime) > SecurityUpdatePeriod {
		mlog.Debug("Checking for security update from Mattermost")

		v := url.Values{}

		v.Set(PropSecurityID, s.TelemetryId())
		v.Set(PropSecurityBuild, model.CurrentVersion+"."+model.BuildNumber)
		v.Set(PropSecurityEnterpriseReady, model.BuildEnterpriseReady)
		v.Set(PropSecurityDatabase, *s.platform.Config().SqlSettings.DriverName)
		v.Set(PropSecurityOS, runtime.GOOS)

		if props[model.SystemRanUnitTests] != "" {
			v.Set(PropSecurityUnitTests, "1")
		} else {
			v.Set(PropSecurityUnitTests, "0")
		}

		systemSecurityLastTime := &model.System{Name: model.SystemLastSecurityTime, Value: strconv.FormatInt(currentTime, 10)}
		if lastSecurityTime == 0 {
			s.Store().System().Save(systemSecurityLastTime)
		} else {
			s.Store().System().Update(systemSecurityLastTime)
		}

		if count, err := s.Store().User().Count(model.UserCountOptions{IncludeDeleted: true}); err == nil {
			v.Set(PropSecurityUserCount, strconv.FormatInt(count, 10))
		}

		if ucr, err := s.Store().Status().GetTotalActiveUsersCount(); err == nil {
			v.Set(PropSecurityActiveUserCount, strconv.FormatInt(ucr, 10))
		}

		if teamCount, err := s.Store().Team().AnalyticsTeamCount(nil); err == nil {
			v.Set(PropSecurityTeamCount, strconv.FormatInt(teamCount, 10))
		}

		res, err := http.Get(PropSecurityURL + "/security?" + v.Encode())
		if err != nil {
			mlog.Error("Failed to get security update information from Mattermost.")
			return
		}

		defer res.Body.Close()

		var bulletins model.SecurityBulletins
		if jsonErr := json.NewDecoder(res.Body).Decode(&bulletins); jsonErr != nil {
			s.Log().Error("Failed to decode JSON", mlog.Err(jsonErr))
			return
		}

		for _, bulletin := range bulletins {
			if bulletin.AppliesToVersion == model.CurrentVersion {
				if props["SecurityBulletin_"+bulletin.Id] == "" {
					users, userErr := s.Store().User().GetSystemAdminProfiles()
					if userErr != nil {
						mlog.Error("Failed to get system admins for security update information from Mattermost.")
						return
					}

					resBody, err := http.Get(PropSecurityURL + "/bulletins/" + bulletin.Id)
					if err != nil {
						mlog.Error("Failed to get security bulletin details")
						return
					}

					body, err := io.ReadAll(resBody.Body)
					resBody.Body.Close()
					if err != nil || resBody.StatusCode != 200 {
						mlog.Error("Failed to read security bulletin details")
						return
					}

					for _, user := range users {
						mlog.Info("Sending security bulletin", mlog.String("bulletin_id", bulletin.Id), mlog.String("user_email", user.Email))
						license := s.License()
						mailConfig := s.MailServiceConfig()
						mail.SendMailUsingConfig(user.Email, i18n.T("mattermost.bulletin.subject"), string(body), mailConfig, license != nil && *license.Features.Compliance, "", "", "", "")
					}

					bulletinSeen := &model.System{Name: "SecurityBulletin_" + bulletin.Id, Value: bulletin.Id}
					s.Store().System().Save(bulletinSeen)
				}
			}
		}
	}
}
