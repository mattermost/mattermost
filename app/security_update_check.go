// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"io/ioutil"
	"net/http"
	"net/url"
	"runtime"
	"strconv"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

const (
	SECURITY_URL           = "https://d7zmvsa9e04kk.cloudfront.net"
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
				l4g.Debug(utils.T("mattermost.security_checks.debug"))

				v := url.Values{}

				v.Set(PROP_SECURITY_ID, utils.CfgDiagnosticId)
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
					l4g.Error(utils.T("mattermost.security_info.error"))
					return
				}

				bulletins := model.SecurityBulletinsFromJson(res.Body)
				consumeAndClose(res)

				for _, bulletin := range bulletins {
					if bulletin.AppliesToVersion == model.CurrentVersion {
						if props["SecurityBulletin_"+bulletin.Id] == "" {
							if results := <-a.Srv.Store.User().GetSystemAdminProfiles(); results.Err != nil {
								l4g.Error(utils.T("mattermost.system_admins.error"))
								return
							} else {
								users := results.Data.(map[string]*model.User)

								resBody, err := http.Get(SECURITY_URL + "/bulletins/" + bulletin.Id)
								if err != nil {
									l4g.Error(utils.T("mattermost.security_bulletin.error"))
									return
								}

								body, err := ioutil.ReadAll(resBody.Body)
								res.Body.Close()
								if err != nil || resBody.StatusCode != 200 {
									l4g.Error(utils.T("mattermost.security_bulletin_read.error"))
									return
								}

								for _, user := range users {
									l4g.Info(utils.T("mattermost.send_bulletin.info"), bulletin.Id, user.Email)
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
