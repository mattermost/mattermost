// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"runtime"
	"strconv"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	SECURITY_URL           = "https://securityupdatecheck.mattermost.com"
	SECURITY_UPDATE_PERIOD = 86400000 // 24 hours in milliseconds.

	PROP_SECURITY_ID                = "id"
	PROP_SECURITY_BUILD             = "b"
	PROP_SECURITY_ENTERPRISE_READY  = "be"
	PROP_SECURITY_DATABASE          = "db"
	PROP_SECURITY_OS                = "os"
	PROP_SECURITY_USER_COUNT        = "uc"
	PROP_SECURITY_TEAM_COUNT        = "tc"
	PROP_SECURITY_ACTIVE_USER_COUNT = "auc"
	PROP_SECURITY_UNIT_TESTS        = "ut"
)

func (a *App) DoSecurityUpdateCheck() {
	if *a.Config().ServiceSettings.EnableSecurityFixAlert {
		if result := <-a.Srv.Store.System().Get(); result.Err == nil {
			props := result.Data.(model.StringMap)
			lastSecurityTime, _ := strconv.ParseInt(props[model.SYSTEM_LAST_SECURITY_TIME], 10, 0)
			currentTime := model.GetMillis()

			if (currentTime - lastSecurityTime) > SECURITY_UPDATE_PERIOD {
				mlog.Debug("Checking for security update from Mattermost")

				v := url.Values{}

				v.Set(PROP_SECURITY_ID, a.DiagnosticId())
				v.Set(PROP_SECURITY_BUILD, model.CurrentVersion+"."+model.BuildNumber)
				v.Set(PROP_SECURITY_ENTERPRISE_READY, model.BuildEnterpriseReady)
				v.Set(PROP_SECURITY_DATABASE, *a.Config().SqlSettings.DriverName)
				v.Set(PROP_SECURITY_OS, runtime.GOOS)

				if len(props[model.SYSTEM_RAN_UNIT_TESTS]) > 0 {
					v.Set(PROP_SECURITY_UNIT_TESTS, "1")
				} else {
					v.Set(PROP_SECURITY_UNIT_TESTS, "0")
				}

				systemSecurityLastTime := &model.System{Name: model.SYSTEM_LAST_SECURITY_TIME, Value: strconv.FormatInt(currentTime, 10)}
				if lastSecurityTime == 0 {
					<-a.Srv.Store.System().Save(systemSecurityLastTime)
				} else {
					<-a.Srv.Store.System().Update(systemSecurityLastTime)
				}

				if ucr := <-a.Srv.Store.User().GetTotalUsersCount(); ucr.Err == nil {
					v.Set(PROP_SECURITY_USER_COUNT, strconv.FormatInt(ucr.Data.(int64), 10))
				}

				if ucr := <-a.Srv.Store.Status().GetTotalActiveUsersCount(); ucr.Err == nil {
					v.Set(PROP_SECURITY_ACTIVE_USER_COUNT, strconv.FormatInt(ucr.Data.(int64), 10))
				}

				if tcr := <-a.Srv.Store.Team().AnalyticsTeamCount(); tcr.Err == nil {
					v.Set(PROP_SECURITY_TEAM_COUNT, strconv.FormatInt(tcr.Data.(int64), 10))
				}

				res, err := http.Get(SECURITY_URL + "/security?" + v.Encode())
				if err != nil {
					mlog.Error("Failed to get security update information from Mattermost.")
					return
				}

				bulletins := model.SecurityBulletinsFromJson(res.Body)
				consumeAndClose(res)

				for _, bulletin := range bulletins {
					if bulletin.AppliesToVersion == model.CurrentVersion {
						if props["SecurityBulletin_"+bulletin.Id] == "" {
							if results := <-a.Srv.Store.User().GetSystemAdminProfiles(); results.Err != nil {
								mlog.Error("Failed to get system admins for security update information from Mattermost.")
								return
							} else {
								users := results.Data.(map[string]*model.User)

								resBody, err := http.Get(SECURITY_URL + "/bulletins/" + bulletin.Id)
								if err != nil {
									mlog.Error("Failed to get security bulletin details")
									return
								}

								body, err := ioutil.ReadAll(resBody.Body)
								res.Body.Close()
								if err != nil || resBody.StatusCode != 200 {
									mlog.Error("Failed to read security bulletin details")
									return
								}

								for _, user := range users {
									mlog.Info(fmt.Sprintf("Sending security bulletin for %v to %v", bulletin.Id, user.Email))
									a.SendMail(user.Email, utils.T("mattermost.bulletin.subject"), string(body))
								}
							}

							bulletinSeen := &model.System{Name: "SecurityBulletin_" + bulletin.Id, Value: bulletin.Id}
							<-a.Srv.Store.System().Save(bulletinSeen)
						}
					}
				}
			}
		}
	}
}
