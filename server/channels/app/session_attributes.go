// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/avct/uasurfer"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

func (a *App) sessionAttributesEnabled() bool {
	if !a.Config().FeatureFlags.SessionAttributes {
		return false
	}
	return model.MinimumEnterpriseAdvancedLicense(a.License())
}

// sessionAttributeField is parsed once per schema version and shared by every
// request, so it must not be modified.
type sessionAttributeField struct {
	*model.SAField
	validator *model.SessionAttributeValueValidator
}

type sessionAttributeSchema struct {
	version string
	fields  map[string]*sessionAttributeField
}

func (a *App) getSessionAttributeFieldsByName(rctx request.CTX) (map[string]*sessionAttributeField, *model.AppError) {
	group, err := a.Srv().propertyService.Group(model.SessionAttributesPropertyGroupName)
	if err != nil {
		return nil, model.NewAppError("getSessionAttributeFieldsByName", "app.property_group.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Read the version before the fields: a change landing in between leaves
	// newer fields under the older version, which the next call parses again.
	version, err := a.Srv().Store().PropertyField().GetForGroupVersion(rctx, group.ID)
	if err != nil {
		return nil, model.NewAppError("getSessionAttributeFieldsByName", "app.property_field.get_for_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if schema := a.Srv().sessionAttributeSchema.Load(); schema != nil && schema.version == version {
		return schema.fields, nil
	}

	fields, err := a.Srv().Store().PropertyField().GetForGroup(rctx, group.ID)
	if err != nil {
		return nil, model.NewAppError("getSessionAttributeFieldsByName", "app.property_field.get_for_group.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	fieldsByName := make(map[string]*sessionAttributeField, len(fields))
	for _, field := range fields {
		saField, err := model.SAFieldFromPropertyField(field)
		if err != nil {
			continue
		}
		fieldsByName[field.Name] = &sessionAttributeField{SAField: saField, validator: model.NewSessionAttributeValueValidator(field)}
	}
	a.Srv().sessionAttributeSchema.Store(&sessionAttributeSchema{version: version, fields: fieldsByName})
	return fieldsByName, nil
}

func validatedSessionAttributeField(
	fieldsByName map[string]*sessionAttributeField,
	name, platform string,
	value any,
) bool {
	field, ok := fieldsByName[name]
	return ok && field.EnabledForPlatform(platform) && field.validator.IsValid(value)
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

type requestSessionAttributesContextKey struct{}

// WithRequestSessionAttributes returns rctx carrying the request-scoped session
// attribute inputs of the request (or websocket upgrade request) it serves.
func WithRequestSessionAttributes(rctx request.CTX, attrs *platform.RequestSessionAttributes) request.CTX {
	if attrs == nil {
		return rctx
	}
	return rctx.WithContext(context.WithValue(rctx.Context(), requestSessionAttributesContextKey{}, attrs))
}

// RequestSessionAttributes returns the inputs recorded on rctx by WithRequestSessionAttributes.
func RequestSessionAttributes(rctx request.CTX) *platform.RequestSessionAttributes {
	attrs, _ := rctx.Context().Value(requestSessionAttributesContextKey{}).(*platform.RequestSessionAttributes)
	return attrs
}

// requestScopedSessionAttributes returns the session attributes proven by the
// request rctx serves, checked against the current schema: the server-derived
// ones and, while the proxy header is trusted, tls_device_id.
func (a *App) requestScopedSessionAttributes(rctx request.CTX) (map[string]any, error) {
	inputs := RequestSessionAttributes(rctx)
	if inputs == nil {
		return nil, nil
	}

	fieldsByName, appErr := a.getSessionAttributeFieldsByName(rctx)
	if appErr != nil {
		return nil, appErr
	}

	attrs := make(map[string]any, len(inputs.ServerDerived)+1)
	for name, value := range inputs.ServerDerived {
		if validatedSessionAttributeField(fieldsByName, name, inputs.Platform, value) {
			attrs[name] = value
		}
	}
	if inputs.ProxyDeviceID != "" &&
		*a.Config().AccessControlSettings.TrustProxyDeviceIdentityHeader &&
		validatedSessionAttributeField(fieldsByName, model.SessionAttributesPropertyFieldTLSDDeviceID, inputs.Platform, inputs.ProxyDeviceID) {
		attrs[model.SessionAttributesPropertyFieldTLSDDeviceID] = inputs.ProxyDeviceID
	}
	if len(attrs) == 0 {
		return nil, nil
	}
	return attrs, nil
}

// serverDerivedSessionAttributes returns the platform r comes from and the IP
// address and user agent values it offers, before validation.
func (a *App) serverDerivedSessionAttributes(session *model.Session, r *http.Request) (string, map[string]any) {
	attrs := make(map[string]any, len(model.SessionAttributesRequestDerivedFieldNames))
	if ip := utils.GetIPAddress(r, a.Config().ServiceSettings.TrustedProxyIPHeader); ip != "" {
		attrs[model.SessionAttributesPropertyFieldIPAddress] = ip
	}

	uaStr := r.UserAgent()
	if uaStr == "" && session.IsMobileApp() {
		// The mobile app's websocket upgrade request has no User-Agent. Its login request
		// had one, and the session props hold what the same helpers derived from it.
		browserName, browserVersion, _ := strings.Cut(session.Props[model.SessionPropBrowser], "/")
		for name, v := range map[string]string{
			model.SessionAttributesPropertyFieldUserAgentPlatform:       session.Props[model.SessionPropPlatform],
			model.SessionAttributesPropertyFieldUserAgentOS:             session.Props[model.SessionPropOs],
			model.SessionAttributesPropertyFieldUserAgentBrowserName:    browserName,
			model.SessionAttributesPropertyFieldUserAgentBrowserVersion: browserVersion,
		} {
			if v != "" {
				attrs[name] = v
			}
		}
		return model.SessionAttributePlatformMobile, attrs
	}

	ua := uasurfer.Parse(uaStr)
	for name, v := range map[string]string{
		model.SessionAttributesPropertyFieldUserAgentPlatform:       getPlatformName(ua, uaStr),
		model.SessionAttributesPropertyFieldUserAgentOS:             getOSName(ua, uaStr),
		model.SessionAttributesPropertyFieldUserAgentBrowserName:    getBrowserName(ua, uaStr),
		model.SessionAttributesPropertyFieldUserAgentBrowserVersion: getBrowserVersion(ua, uaStr),
	} {
		if v != "" {
			attrs[name] = v
		}
	}
	return inferSessionAttributePlatform(r), attrs
}

// requestScopedSessionAttributesFingerprint returns a stable hash of attrs, or
// "" when there are none. It must be deterministic across cluster nodes.
func requestScopedSessionAttributesFingerprint(attrs map[string]any) string {
	if len(attrs) == 0 {
		return ""
	}

	h := sha256.New()
	for _, name := range slices.Sorted(maps.Keys(attrs)) {
		fmt.Fprintf(h, "%s=%v\x00", name, attrs[name])
	}
	return hex.EncodeToString(h.Sum(nil))[:16]
}

// ProcessSessionAttributesRequest refreshes the session's cached attributes
// from r and returns rctx carrying the request-scoped attribute inputs r offered.
func (a *App) ProcessSessionAttributesRequest(rctx request.CTX, r *http.Request) request.CTX {
	return WithRequestSessionAttributes(rctx, a.refreshSessionAttributes(rctx, r))
}

// refreshSessionAttributes returns the request-scoped session attribute inputs
// of r, or nil when r's session may not carry session attributes.
func (a *App) refreshSessionAttributes(rctx request.CTX, r *http.Request) *platform.RequestSessionAttributes {
	if !a.sessionAttributesEnabled() {
		return nil
	}

	// Only process session attributes for actual end-user sessions. Local
	// sessions and OAuth app sessions do not correspond to a physical device
	// with a real security posture, so they must not be able to self-attest
	// session attributes.
	if rctx.Session().Local || rctx.Session().IsOAuth {
		return nil
	}
	switch rctx.Session().Props[model.SessionPropType] {
	case model.SessionTypeUserAccessToken, model.SessionTypeCloudKey, model.SessionTypeRemoteclusterToken:
		return nil
	}

	if err := rctx.Session().IsValid(); err != nil || rctx.Session().IsExpired() {
		return nil
	}

	fieldsByName, appErr := a.getSessionAttributeFieldsByName(rctx)
	if appErr != nil {
		rctx.Logger().Warn("Failed to load session attribute schema", mlog.Err(appErr))
		return nil
	}

	inputs := &platform.RequestSessionAttributes{}
	inputs.Platform, inputs.ServerDerived = a.serverDerivedSessionAttributes(rctx.Session(), r)
	attrsToMerge := make(map[string]any)

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
					if !validatedSessionAttributeField(fieldsByName, name, inputs.Platform, value) {
						continue
					}
					attrsToMerge[name] = value
				}
			}
		}
	}

	if *a.Config().AccessControlSettings.TrustProxyDeviceIdentityHeader {
		inputs.ProxyDeviceID = strings.TrimSpace(r.Header.Get(model.SessionAttributeHeaderProxyDeviceID))
		if inputs.ProxyDeviceID != "" && validatedSessionAttributeField(fieldsByName, model.SessionAttributesPropertyFieldTLSDDeviceID, inputs.Platform, inputs.ProxyDeviceID) {
			// Cache tls_device_id for device ID consistency checks, but ABAC
			// evaluation uses only the request-scoped value.
			attrsToMerge[model.SessionAttributesPropertyFieldTLSDDeviceID] = inputs.ProxyDeviceID
		}
	}

	cached, timestamps, err := a.Srv().Store().SessionAttribute().Get(rctx.Session().Id)
	if err != nil && !errors.Is(err, cache.ErrKeyNotFound) {
		rctx.Logger().Warn("Failed to load cached session attributes", mlog.Err(err))
		if *a.Config().AccessControlSettings.EnforceDeviceIDConsistency {
			return nil
		}
	}

	if *a.Config().AccessControlSettings.EnforceDeviceIDConsistency {
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

			return nil
		}
	}

	// Skip values that are unchanged and younger than half their TTL; the rest of
	// the TTL plus the grace period covers a lost cluster broadcast.
	now := model.GetMillis()
	for name, value := range attrsToMerge {
		if cached[name] == value && now-timestamps[name] < int64(fieldsByName[name].Attrs.TTLSeconds)*500 {
			delete(attrsToMerge, name)
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

	return inputs
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

	fieldsByName, appErr := a.getSessionAttributeFieldsByName(rctx)
	if appErr != nil {
		return nil, appErr
	}

	platform := inferSessionAttributePlatform(r)
	manifest := make([]*model.SessionAttributeManifestEntry, 0, len(fieldsByName))
	for name, field := range fieldsByName {
		if !field.EnabledForPlatform(platform) {
			continue
		}
		if _, isDerived := model.SessionAttributesRequestDerivedFieldNames[name]; isDerived {
			continue
		}
		manifest = append(manifest, &model.SessionAttributeManifestEntry{
			Name:               name,
			Type:               string(field.Type),
			TTLSeconds:         field.Attrs.TTLSeconds,
			GracePeriodSeconds: field.Attrs.GracePeriodSeconds,
			Platforms:          field.Attrs.Platforms,
			DisplayName:        field.Attrs.DisplayName,
		})
	}

	return manifest, nil
}

// GetSessionAttributes returns the unexpired cached attributes of sessionID
// that ABAC evaluation uses. tls_device_id is omitted because it is cached
// only for EnforceDeviceIDConsistency; ABAC evaluation takes it from the
// current request.
func (a *App) GetSessionAttributes(rctx request.CTX, sessionID string) (map[string]any, *model.AppError) {
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

	fieldsByName, appErr := a.getSessionAttributeFieldsByName(rctx)
	if appErr != nil {
		return nil, appErr
	}

	filtered := filterStaleSessionAttributes(attrs, timestamps, fieldsByName)
	delete(filtered, model.SessionAttributesPropertyFieldTLSDDeviceID)
	if len(filtered) == 0 {
		return nil, nil
	}
	return filtered, nil
}

func filterStaleSessionAttributes(attrs map[string]any, timestamps map[string]int64, fieldsByName map[string]*sessionAttributeField) map[string]any {
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
		timestamp, ok := timestamps[name]
		if !ok {
			continue
		}
		expiry := time.Duration(field.Attrs.TTLSeconds+field.Attrs.GracePeriodSeconds) * time.Second
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
