// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
	"github.com/pkg/errors"
	date_constraints "github.com/reflog/dateconstraints"
)

const MAX_REPEAT_VIEWINGS = 3

func noticeMatchesConditions(a *App, lastViewed int64, userId, teamId string, client model.NoticeClientType, clientVersion string, locale string, notice *model.ProductNotice) (bool, error) {
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

	now := time.Now().UTC()
	if cnd.DisplayDate != nil {
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
		sku := a.Srv().ClientLicense()["SkuShortName"]
		if !cnd.Sku.Matches(sku) {
			return false, nil
		}
	}

	// check the target audience
	if cnd.Audience != nil {
		isAdmin := a.SessionHasPermissionTo(*a.Session(), model.PERMISSION_MANAGE_SYSTEM)
		teamAdmin := a.SessionHasPermissionToTeam(*a.Session(), teamId, model.PERMISSION_MANAGE_TEAM)
		if !cnd.Audience.Matches(isAdmin, teamAdmin) {
			return false, nil
		}

	}

	// check if our server config matches the notice
	for k, v := range cnd.ServerConfig {
		value, found := config.GetConfigValueByPath(a.Config(), strings.Split(k, "."))
		if !found || value != v {
			return false, nil
		}
	}
	return true, nil
}

func (a *App) GetProductNotices(lastViewed int64, userId, teamId string, client model.NoticeClientType, clientVersion string, locale string) (model.NoticeMessages, *model.AppError) {
	views, err := a.Srv().Store.ProductNotices().GetViews(userId)
	if err != nil {
		return nil, model.NewAppError("GetProductNotices", "api.system.update_viewed_notices.failed", nil, err.Error(), http.StatusBadRequest)
	}

	if a.notices == nil { // nothing yet
		return nil, nil
	}

	var filteredNotices []model.NoticeMessage

	getViewState := func(nid string) *model.ProductNoticeViewState {
		for _, v := range views {
			if v.NoticeId == nid {
				return &v
			}
		}
		return nil
	}
	for _, notice := range *a.notices {
		notice := notice // pin
		// check if the notice has been viewed already
		view := getViewState(notice.ID)
		if view != nil {
			repeatable := notice.Repeatable != nil && *notice.Repeatable
			if !repeatable && view.Viewed > 0 {
				continue
			}
			if repeatable && view.Viewed > MAX_REPEAT_VIEWINGS {
				continue
			}
		}
		result, err := noticeMatchesConditions(a, lastViewed, userId, teamId, client, clientVersion, locale, &notice)
		if err != nil {
			return nil, model.NewAppError("GetProductNotices", "api.system.update_viewed_notices.parsing_failed", nil, err.Error(), http.StatusBadRequest)
		}
		if result {
			selectedLocale := "enUS"
			filteredNotices = append(filteredNotices, notice.LocalizedMessages[selectedLocale])
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

var noticesCache = utils.RequestCache{}

func (a *App) UpdateProductNotices() *model.AppError {
	data, err := utils.GetUrlWithCache("https://raw.githubusercontent.com/reflog/notices-experiment/master/notices.json", &noticesCache)
	if err != nil {
		return model.NewAppError("UpdateProductNotices", "api.system.update_viewed_notices.fetch_failed", nil, err.Error(), http.StatusBadRequest)
	}
	notices, err := model.UnmarshalProductNotices(data)
	if err != nil {
		return model.NewAppError("UpdateProductNotices", "api.system.update_viewed_notices.parse_failed", nil, err.Error(), http.StatusBadRequest)
	}

	a.notices = &notices

	if err := a.Srv().Store.ProductNotices().ClearOldNotices(a.notices); err != nil {
		return model.NewAppError("UpdateProductNotices", "api.system.update_viewed_notices.clear_failed", nil, err.Error(), http.StatusBadRequest)
	}
	return nil
}
