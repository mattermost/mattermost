// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/avct/uasurfer"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

func (a *App) sessionAttributesEnabled() bool {
	if !a.Config().FeatureFlags.SessionAttributes {
		return false
	}
	return model.MinimumEnterpriseAdvancedLicense(a.License())
}

func (a *App) getSessionAttributeFieldsByName() (map[string]*model.PropertyField, *model.AppError) {
	group, err := a.Srv().propertyService.Group(model.SessionAttributesPropertyGroupName)
	if err != nil {
		return nil, model.NewAppError("getSessionAttributeFieldsByName", "app.property_group.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	fields, err := a.Srv().Store().PropertyField().GetForGroup(context.Background(), group.ID)
	if err != nil {
		return nil, model.NewAppError("getSessionAttributeFieldsByName", "app.property_field.get_for_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	fieldsByName := make(map[string]*model.PropertyField, len(fields))
	for _, field := range fields {
		fieldsByName[field.Name] = field
	}
	return fieldsByName, nil
}

func validatedSessionAttributeField(
	fieldsByName map[string]*model.PropertyField,
	name, platform string,
	value any,
) bool {
	field, ok := fieldsByName[name]
	if !ok {
		return false
	}
	saField, err := model.SAFieldFromPropertyField(field)
	if err != nil || !saField.EnabledForPlatform(platform) {
		return false
	}
	return model.IsValidSessionAttributeValue(field, value)
}

func inferSessionAttributePlatform(r *http.Request) string {
	uaStr := r.UserAgent()
	ua := uasurfer.Parse(uaStr)
	browserName := getBrowserName(ua, uaStr)
	switch browserName {
	case "Desktop App":
		return model.SessionAttributePlatformDesktop
	case "Mobile App":
		return model.SessionAttributePlatformMobile
	default:
		return model.SessionAttributePlatformBrowser
	}
}

func (a *App) ProcessSessionAttributesRequest(rctx request.CTX, r *http.Request) {
	if !a.sessionAttributesEnabled() {
		return
	}

	// Only process session attributes for actual user sessions.
	if rctx.Session().Local {
		return
	}
	switch rctx.Session().Props[model.SessionPropType] {
	case model.SessionTypeUserAccessToken, model.SessionTypeCloudKey, model.SessionTypeRemoteclusterToken:
		return
	}

	if err := rctx.Session().IsValid(); err != nil || rctx.Session().IsExpired() {
		return
	}

	fieldsByName, appErr := a.getSessionAttributeFieldsByName()
	if appErr != nil {
		rctx.Logger().Warn("Failed to load session attribute schema", mlog.Err(appErr))
		return
	}

	platform := inferSessionAttributePlatform(r)
	uaStr := r.UserAgent()
	ua := uasurfer.Parse(uaStr)
	attrsToMerge := make(map[string]any)

	for name := range model.SessionAttributesRequestDerivedFieldNames {
		var v string
		switch name {
		case model.SessionAttributesPropertyFieldUserAgentPlatform:
			v = getPlatformName(ua, uaStr)
		case model.SessionAttributesPropertyFieldUserAgentOS:
			v = getOSName(ua, uaStr)
		case model.SessionAttributesPropertyFieldUserAgentBrowserName:
			v = getBrowserName(ua, uaStr)
		case model.SessionAttributesPropertyFieldUserAgentBrowserVersion:
			v = getBrowserVersion(ua, uaStr)
		case model.SessionAttributesPropertyFieldIPAddress:
			v = utils.GetIPAddress(r, a.Config().ServiceSettings.TrustedProxyIPHeader)
		}
		if v == "" || !validatedSessionAttributeField(fieldsByName, name, platform, v) {
			continue
		}
		attrsToMerge[name] = v
	}

	if headerValue := r.Header.Get(model.SessionAttributeHeaderClientAttributes); headerValue != "" {
		decoded, decodeErr := base64.StdEncoding.DecodeString(headerValue)
		if decodeErr != nil {
			rctx.Logger().Warn("Failed to parse client session attributes header", mlog.Err(fmt.Errorf("decode session attributes header: %w", decodeErr)))
		} else {
			var clientAttrs map[string]any
			if unmarshalErr := json.Unmarshal(decoded, &clientAttrs); unmarshalErr != nil {
				rctx.Logger().Warn("Failed to parse client session attributes header", mlog.Err(fmt.Errorf("unmarshal session attributes header: %w", unmarshalErr)))
			} else {
				if clientAttrs == nil {
					clientAttrs = map[string]any{}
				}
				for name, value := range clientAttrs {
					if name == model.SessionAttributesPropertyFieldTLSDDeviceID {
						continue
					}
					if _, isServerDerived := model.SessionAttributesRequestDerivedFieldNames[name]; isServerDerived {
						continue
					}
					if !validatedSessionAttributeField(fieldsByName, name, platform, value) {
						continue
					}
					attrsToMerge[name] = value
				}
			}
		}
	}

	if *a.Config().AccessControlSettings.TrustProxyDeviceIdentityHeader {
		if proxyDeviceID := strings.TrimSpace(r.Header.Get(model.SessionAttributeHeaderProxyDeviceID)); proxyDeviceID != "" {
			if validatedSessionAttributeField(fieldsByName, model.SessionAttributesPropertyFieldTLSDDeviceID, platform, proxyDeviceID) {
				attrsToMerge[model.SessionAttributesPropertyFieldTLSDDeviceID] = proxyDeviceID
			}
		}
	}

	if *a.Config().AccessControlSettings.EnforceDeviceIDConsistency {
		cached, _, err := a.Srv().Store().SessionAttribute().Get(rctx.Session().Id)
		if err != nil && !errors.Is(err, cache.ErrKeyNotFound) {
			rctx.Logger().Warn("Failed to load cached session attributes for device ID consistency check", mlog.Err(err))
			return
		}

		for name := range model.SessionAttributesDeviceIDFieldNames {
			var incomingValue, cachedValue string
			if v := attrsToMerge[name]; v != nil {
				if s, ok := v.(string); ok {
					incomingValue = s
				}
			}
			if cached != nil {
				if v := cached[name]; v != nil {
					if s, ok := v.(string); ok {
						cachedValue = s
					}
				}
			}

			if incomingValue == "" || cachedValue == "" || incomingValue == cachedValue {
				continue
			}

			if revokeErr := a.RevokeSessionById(rctx, rctx.Session().Id); revokeErr != nil {
				rctx.Logger().Warn("Failed to revoke session after device ID mismatch", mlog.Err(revokeErr))
			} else {
				auditRec := a.MakeAuditRecord(rctx, model.AuditEventRevokeSession, model.AuditStatusSuccess)
				model.AddEventParameterAuditableToAuditRec(auditRec, "session", rctx.Session())
				defer a.LogAuditRec(rctx, auditRec, nil)
			}

			return
		}
	}

	if len(attrsToMerge) > 0 {
		refreshAt := model.GetMillis()
		if err := a.Srv().Store().SessionAttribute().Refresh(rctx.Session().Id, attrsToMerge, refreshAt); err != nil {
			rctx.Logger().Warn("Failed to refresh session attributes", mlog.Err(err))
		} else {
			a.broadcastSessionAttributes(rctx, rctx.Session().Id, attrsToMerge, refreshAt)
		}
	}
}

func (a *App) broadcastSessionAttributes(rctx request.CTX, sessionID string, attrs map[string]any, refreshAt int64) {
	cluster := a.Cluster()
	if cluster == nil {
		return
	}

	data, err := json.Marshal(model.SessionAttributesClusterPayload{
		SessionID: sessionID,
		Attrs:     attrs,
		Timestamp: refreshAt,
	})
	if err != nil {
		rctx.Logger().Warn("Failed to encode session attributes for cluster broadcast", mlog.Err(err))
		return
	}

	cluster.SendClusterMessage(&model.ClusterMessage{
		Event:    model.ClusterEventUpdateSessionAttributes,
		SendType: model.ClusterSendBestEffort,
		Data:     data,
	})
}

func (a *App) GetSessionAttributesManifest(rctx request.CTX, r *http.Request) ([]*model.SessionAttributeManifestEntry, *model.AppError) {
	if !a.sessionAttributesEnabled() {
		return nil, model.NewAppError("GetSessionAttributesManifest", "api.user.session_attributes.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	fieldsByName, appErr := a.getSessionAttributeFieldsByName()
	if appErr != nil {
		return nil, appErr
	}

	platform := inferSessionAttributePlatform(r)
	manifest := make([]*model.SessionAttributeManifestEntry, 0, len(fieldsByName))
	for _, field := range fieldsByName {
		saField, err := model.SAFieldFromPropertyField(field)
		if err != nil || !saField.EnabledForPlatform(platform) {
			continue
		}
		if _, isDerived := model.SessionAttributesRequestDerivedFieldNames[field.Name]; isDerived {
			continue
		}
		manifest = append(manifest, &model.SessionAttributeManifestEntry{
			Name:               field.Name,
			Type:               string(field.Type),
			TTLSeconds:         saField.Attrs.TTLSeconds,
			GracePeriodSeconds: saField.Attrs.GracePeriodSeconds,
			Platforms:          saField.Attrs.Platforms,
			DisplayName:        saField.Attrs.DisplayName,
		})
	}

	return manifest, nil
}

func (a *App) GetSessionAttributes(sessionID string) (map[string]any, *model.AppError) {
	if !a.sessionAttributesEnabled() {
		return nil, nil
	}

	attrs, timestamps, err := a.Srv().Store().SessionAttribute().Get(sessionID)
	if err != nil {
		if errors.Is(err, cache.ErrKeyNotFound) {
			return nil, nil
		}
		return nil, model.NewAppError("GetSessionAttributes", "app.access_control.get_session_attributes.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	fieldsByName, appErr := a.getSessionAttributeFieldsByName()
	if appErr != nil {
		return nil, appErr
	}

	return filterStaleSessionAttributes(attrs, timestamps, fieldsByName), nil
}

func filterStaleSessionAttributes(attrs map[string]any, timestamps map[string]int64, fieldsByName map[string]*model.PropertyField) map[string]any {
	if len(attrs) == 0 {
		return nil
	}

	now := time.Now()
	filtered := make(map[string]any, len(attrs))
	for name, value := range attrs {
		field, ok := fieldsByName[name]
		if !ok {
			continue
		}
		saField, err := model.SAFieldFromPropertyField(field)
		if err != nil {
			continue
		}
		timestamp, ok := timestamps[name]
		if !ok {
			continue
		}
		expiry := time.Duration(saField.Attrs.TTLSeconds+saField.Attrs.GracePeriodSeconds) * time.Second
		if now.After(time.UnixMilli(timestamp).Add(expiry)) {
			continue
		}
		filtered[name] = value
	}
	if len(filtered) == 0 {
		return nil
	}
	return filtered
}
