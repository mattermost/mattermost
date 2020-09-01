// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"reflect"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/pkg/errors"
	"github.com/reflog/dateconstraints"
)

const MAX_REPEAT_VIEWINGS = 3

// where to fetch notices from. setting as var to allow overriding during build/test
var NOTICES_JSON_URL = "https://raw.githubusercontent.com/reflog/notices-experiment/master/notices.json"

// http request cache
var noticesCache = utils.RequestCache{}

// cached counts that are used during notice condition validation
var cachedPostCount int64
var cachedUserCount int64

// previously fetched notices
var cachedNotices model.ProductNotices

func noticeMatchesConditions(a *App, client model.NoticeClientType, clientVersion, locale string, postCount, userCount int64, isSystemAdmin, isTeamAdmin bool, isCloud bool, sku string, notice *model.ProductNotice) (bool, error) {
	cnd := notice.Conditions

	// check client type
	if cnd.ClientType != nil {
		if !cnd.ClientType.Matches(client) {
			return false, nil
		}
	}

	// check if client version is in notice range
	clientVersions := cnd.DesktopVersion
	if client == model.NoticeClientType_MobileAndroid || client == model.NoticeClientType_MobileIos {
		clientVersions = cnd.MobileVersion
	}

	clientVersionParsed, err := semver.NewVersion(clientVersion)
	if err != nil {
		return false, errors.Wrapf(err, "Cannot parse version range %s", clientVersion)
	}

	for _, v := range clientVersions {
		c, err := semver.NewConstraint(v)
		if err != nil {
			return false, errors.Wrapf(err, "Cannot parse version range %s", v)
		}
		if !c.Check(clientVersionParsed) {
			return false, nil
		}
	}

	// check if notice date range matches current
	if cnd.DisplayDate != nil {
		now := time.Now().UTC()
		c, err := date_constraints.NewConstraint(*cnd.DisplayDate)
		if err != nil {
			return false, errors.Wrapf(err, "Cannot parse date range %s", *cnd.DisplayDate)
		}
		if !c.Check(&now) {
			return false, nil
		}
	}

	// check if current server version is notice range
	serverVersion, _ := semver.NewVersion(model.CurrentVersion)
	for _, v := range cnd.ServerVersion {
		c, err := semver.NewConstraint(v)
		if err != nil {
			return false, errors.Wrapf(err, "Cannot parse version range %s", v)
		}
		if !c.Check(serverVersion) {
			return false, nil
		}
	}

	// check if sku matches our license
	if cnd.Sku != nil {
		if !cnd.Sku.Matches(sku) {
			return false, nil
		}
	}

	// check the target audience
	if cnd.Audience != nil {
		if !cnd.Audience.Matches(isSystemAdmin, isTeamAdmin) {
			return false, nil
		}

	}

	// check user count condition against previously calculated total user count
	if cnd.NumberOfUsers != nil && userCount > 0 {
		if userCount < *cnd.NumberOfUsers {
			return false, nil
		}
	}

	// check post count condition against previously calculated total post count
	if cnd.NumberOfPosts != nil && postCount > 0 {
		if postCount < *cnd.NumberOfPosts {
			return false, nil
		}
	}

	// check if our server config matches the notice
	for k, v := range cnd.ServerConfig {
		if !validateConfigEntry(a, k, v) {
			return false, nil
		}
	}

	// check the type of installation
	if cnd.InstanceType != nil {
		if !cnd.InstanceType.Matches(isCloud) {
			return false, nil
		}
	}

	return true, nil
}

func validateConfigEntry(a *App, path string, expectedValue interface{}) bool {
	value, found := config.GetValueByPath(strings.Split(path, "."), a.Config())
	if !found {
		return false
	}
	vt := reflect.ValueOf(value)
	if vt.IsNil() {
		return expectedValue == nil
	}
	if vt.Kind() == reflect.Ptr {
		vt = vt.Elem()
	}
	val := vt.Interface()
	return val == expectedValue
}

func (a *App) GetProductNotices(lastViewed int64, userId, teamId string, client model.NoticeClientType, clientVersion string, locale string) (model.NoticeMessages, *model.AppError) {
	isSystemAdmin := a.SessionHasPermissionTo(*a.Session(), model.PERMISSION_MANAGE_SYSTEM)
	isTeamAdmin := a.SessionHasPermissionToTeam(*a.Session(), teamId, model.PERMISSION_MANAGE_TEAM)

	// check if notices for regular users are disabled
	if !*a.Srv().Config().AnnouncementSettings.UserNoticesEnabled && !isTeamAdmin && !isSystemAdmin {
		return []model.NoticeMessage{}, nil
	}

	// check if notices for admins are disabled
	if !*a.Srv().Config().AnnouncementSettings.AdminNoticesEnabled && (isTeamAdmin || isSystemAdmin) {
		return []model.NoticeMessage{}, nil
	}

	views, err := a.Srv().Store.ProductNotices().GetViews(userId)
	if err != nil {
		return nil, model.NewAppError("GetProductNotices", "api.system.update_viewed_notices.failed", nil, err.Error(), http.StatusBadRequest)
	}

	sku := a.Srv().ClientLicense()["SkuShortName"]
	isCloud := a.Srv().ClientLicense()["Cloud"] != ""

	var filteredNotices []model.NoticeMessage

	for _, notice := range cachedNotices {
		// check if the notice has been viewed already
		var view *model.ProductNoticeViewState
		for _, v := range views {
			if v.NoticeId == notice.ID {
				view = &v
				break
			}
		}
		if view != nil {
			repeatable := notice.Repeatable != nil && *notice.Repeatable
			if !repeatable && view.Viewed > 0 {
				continue
			}
			if repeatable && view.Viewed > MAX_REPEAT_VIEWINGS {
				continue
			}
			if view.Timestamp < lastViewed {
				continue
			}
		}
		currentNotice := notice // pin
		result, err := noticeMatchesConditions(a,
			client,
			clientVersion,
			locale,
			cachedPostCount,
			cachedUserCount,
			isSystemAdmin,
			isTeamAdmin,
			isCloud,
			sku,
			&currentNotice)
		if err != nil {
			return nil, model.NewAppError("GetProductNotices", "api.system.update_notices.validating_failed", nil, err.Error(), http.StatusBadRequest)
		}
		if result {
			selectedLocale := "enUS"
			filteredNotices = append(filteredNotices, model.NoticeMessage{
				NoticeMessageInternal: currentNotice.LocalizedMessages[selectedLocale],
				ID:                    currentNotice.ID,
			})
		}
	}

	return filteredNotices, nil
}

func (a *App) UpdateViewedProductNotices(userId string, noticeIds []string) *model.AppError {
	if err := a.Srv().Store.ProductNotices().View(userId, noticeIds); err != nil {
		return model.NewAppError("UpdateViewedProductNotices", "api.system.update_viewed_notices.failed", nil, err.Error(), http.StatusBadRequest)
	}
	return nil
}

func (a *App) UpdateProductNotices() *model.AppError {
	var appErr *model.AppError
	cachedPostCount, appErr = a.Srv().Store.Post().AnalyticsPostCount("", false, false)
	if appErr != nil {
		mlog.Error("Failed to fetch post count", mlog.String("error", appErr.Error()))
	}

	cachedUserCount, appErr = a.Srv().Store.User().Count(model.UserCountOptions{IncludeDeleted: true})
	if appErr != nil {
		mlog.Error("Failed to fetch user count", mlog.String("error", appErr.Error()))
	}

	data, err := utils.GetUrlWithCache(NOTICES_JSON_URL, &noticesCache)
	if err != nil {
		return model.NewAppError("UpdateProductNotices", "api.system.update_notices.fetch_failed", nil, err.Error(), http.StatusBadRequest)
	}
	cachedNotices, err = model.UnmarshalProductNotices(data)
	if err != nil {
		return model.NewAppError("UpdateProductNotices", "api.system.update_notices.parse_failed", nil, err.Error(), http.StatusBadRequest)
	}

	if err := a.Srv().Store.ProductNotices().ClearOldNotices(&cachedNotices); err != nil {
		return model.NewAppError("UpdateProductNotices", "api.system.update_notices.clear_failed", nil, err.Error(), http.StatusBadRequest)
	}
	return nil
}
