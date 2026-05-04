// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"

	"github.com/avct/uasurfer"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

var requestProvidedSessionAttributeFieldNames = []string{
	model.SessionAttributesPropertyFieldUserAgentPlatform,
	model.SessionAttributesPropertyFieldUserAgentOS,
	model.SessionAttributesPropertyFieldUserAgentBrowserName,
	model.SessionAttributesPropertyFieldUserAgentBrowserVersion,
	model.SessionAttributesPropertyFieldIPAddress,
}

func (a *App) RefreshRequestProvidedSessionAttributesIfNeeded(rctx request.CTX, r *http.Request) {
	if !a.Config().FeatureFlags.SessionAttributes {
		return
	}

	if l := a.License(); !model.MinimumEnterpriseAdvancedLicense(l) {
		return
	}

	session := rctx.Session()
	if session == nil || session.Id == "" || session.UserId == "" || r == nil {
		return
	}
	if session.Local {
		return
	}
	switch session.Props[model.SessionPropType] {
	case model.SessionTypeUserAccessToken, model.SessionTypeCloudKey, model.SessionTypeRemoteclusterToken:
		return
	}

	group, err := a.Srv().propertyService.Group(model.SessionAttributesPropertyGroupName)
	if err != nil {
		rctx.Logger().Warn("Failed to get session attributes property group", mlog.Err(err))
		return
	}
	if group == nil || group.ID == "" {
		return
	}

	existingValues, appErr := a.SearchPropertyValues(rctx, group.ID, model.PropertyValueSearchOpts{
		TargetType: model.PropertyValueTargetTypeSession,
		TargetIDs:  []string{session.Id},
		PerPage:    len(requestProvidedSessionAttributeFieldNames),
	})
	if appErr != nil {
		rctx.Logger().Warn("Failed to search session attribute property values", mlog.Err(appErr))
		return
	}

	valueByFieldID := make(map[string]*model.PropertyValue, len(existingValues))
	for _, v := range existingValues {
		valueByFieldID[v.FieldID] = v
	}

	now := model.GetMillis()
	var toUpsert []*model.PropertyValue
	for _, name := range requestProvidedSessionAttributeFieldNames {
		field, appErr := a.GetPropertyFieldByName(rctx, group.ID, "", name)
		if appErr != nil {
			rctx.Logger().Warn("Failed to get session attribute property field", mlog.String("name", name), mlog.Err(appErr))
			continue
		}
		if field == nil {
			continue
		}

		ttlSecondsF, _ := field.GetAttr(model.PropertyFieldAttributeTTL).(float64)
		ttlSeconds := int64(ttlSecondsF)
		if ttlSeconds <= 0 {
			ttlSeconds = int64(model.SessionAttributeDefaultTTLSeconds)
		}

		if existing, ok := valueByFieldID[field.ID]; ok && now-existing.UpdateAt < ttlSeconds*1000 {
			continue
		}

		text := a.getRequestProvidedSessionAttributeByName(r, name)
		if text == "" {
			continue
		}

		raw, err := json.Marshal(text)
		if err != nil {
			continue
		}

		toUpsert = append(toUpsert, &model.PropertyValue{
			TargetID:   session.Id,
			TargetType: model.PropertyValueTargetTypeSession,
			GroupID:    group.ID,
			FieldID:    field.ID,
			Value:      raw,
			CreatedBy:  session.UserId,
			UpdatedBy:  session.UserId,
		})
	}

	if len(toUpsert) == 0 {
		return
	}

	if _, err := a.UpsertPropertyValues(rctx, toUpsert, "", "", ""); err != nil {
		rctx.Logger().Warn("Failed to upsert session attribute property values", mlog.Err(err))
	}
}

// cleanUpSessionAttributes removes any session attribute property values
// stored for the given session ID. It is safe to call even when no values
// exist (e.g. when the feature flag is off or no requests were ever made
// for the session).
func (a *App) cleanUpSessionAttributes(rctx request.CTX, sessionID string) {
	if sessionID == "" {
		return
	}

	group, err := a.Srv().propertyService.Group(model.SessionAttributesPropertyGroupName)
	if err != nil {
		rctx.Logger().Warn("Failed to get session attributes property group for cleanup", mlog.String("session_id", sessionID), mlog.Err(err))
		return
	}
	if group == nil || group.ID == "" {
		return
	}

	if err := a.Srv().propertyService.DeletePropertyValuesForTarget(rctx, group.ID, model.PropertyValueTargetTypeSession, sessionID); err != nil {
		rctx.Logger().Warn("Failed to delete session attribute property values", mlog.String("session_id", sessionID), mlog.Err(err))
	}
}

func (a *App) getRequestProvidedSessionAttributeByName(r *http.Request, name string) string {
	uaStr := r.UserAgent()
	ua := uasurfer.Parse(uaStr)

	switch name {
	case model.SessionAttributesPropertyFieldUserAgentPlatform:
		return getPlatformName(ua, uaStr)
	case model.SessionAttributesPropertyFieldUserAgentOS:
		return getOSName(ua, uaStr)
	case model.SessionAttributesPropertyFieldUserAgentBrowserName:
		return getBrowserName(ua, uaStr)
	case model.SessionAttributesPropertyFieldUserAgentBrowserVersion:
		return getBrowserVersion(ua, uaStr)
	case model.SessionAttributesPropertyFieldIPAddress:
		return utils.GetIPAddress(r, a.Config().ServiceSettings.TrustedProxyIPHeader)
	}

	return ""
}
