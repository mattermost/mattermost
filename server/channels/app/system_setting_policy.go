// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"sync/atomic"
	"unicode"

	"golang.org/x/sync/singleflight"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const systemSettingPolicySearchPageSize = 200

type cachedSystemSettingRule struct {
	Key   string
	Value string
}

type cachedSystemSettingPolicy struct {
	ID    string
	Roles []string
	Rules []cachedSystemSettingRule
}

var expressionSessionRootPattern = regexp.MustCompile(`\buser\s*\.\s*session\b`)

// expressionReferencesSessionAttributes reports whether expr reads any
// user.session.* attribute.
func expressionReferencesSessionAttributes(expr string) bool {
	return expressionSessionRootPattern.MatchString(expr)
}

type systemSettingPolicyCache struct {
	entries    atomic.Pointer[[]cachedSystemSettingPolicy]
	group      singleflight.Group
	generation atomic.Uint64
}

func newSystemSettingPolicyCache() *systemSettingPolicyCache {
	return &systemSettingPolicyCache{}
}

func (c *systemSettingPolicyCache) Invalidate() {
	c.generation.Add(1)
	c.entries.Store(nil)
}

func (c *systemSettingPolicyCache) Get(rctx request.CTX, policyStore store.AccessControlPolicyStore) ([]cachedSystemSettingPolicy, error) {
	if cached := c.entries.Load(); cached != nil {
		return *cached, nil
	}

	bgCtx := rctx.WithContext(context.WithoutCancel(rctx.Context()))
	gen := c.generation.Load()
	flightKey := fmt.Sprintf("system_setting_policies\x00%d", gen)

	val, err, _ := c.group.Do(flightKey, func() (any, error) {
		if cached := c.entries.Load(); cached != nil {
			return *cached, nil
		}

		items := []cachedSystemSettingPolicy{}
		search := model.AccessControlPolicySearch{
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Limit: systemSettingPolicySearchPageSize,
		}

		for {
			policies, _, searchErr := policyStore.SearchPolicies(bgCtx, search)
			if searchErr != nil {
				return nil, searchErr
			}
			if len(policies) == 0 {
				break
			}

			for _, p := range policies {
				rules := make([]cachedSystemSettingRule, 0, len(p.Rules))
				for _, r := range p.Rules {
					if len(r.Actions) != 1 || r.Expression == "" {
						continue
					}
					rules = append(rules, cachedSystemSettingRule{
						Key:   r.Actions[0],
						Value: r.Value,
					})
				}
				items = append(items, cachedSystemSettingPolicy{
					ID:    p.ID,
					Roles: slices.Clone(p.Roles),
					Rules: rules,
				})
			}

			if len(policies) < systemSettingPolicySearchPageSize {
				break
			}
			search.Cursor = model.AccessControlPolicyCursor{ID: policies[len(policies)-1].ID}
		}

		if c.generation.Load() == gen {
			c.entries.Store(&items)
		}
		return items, nil
	})
	if err != nil {
		return nil, err
	}
	return val.([]cachedSystemSettingPolicy), nil
}

func (ch *Channels) handleClusterInvalidateSystemSettingPolicies(_ *model.ClusterMessage) {
	if ch.systemSettingPoliciesCache != nil {
		ch.systemSettingPoliciesCache.Invalidate()
	}
}

func (ch *Channels) invalidateSystemSettingPolicyCache() {
	if ch.systemSettingPoliciesCache != nil {
		ch.systemSettingPoliciesCache.Invalidate()
	}
	if ch.srv != nil && ch.srv.Platform().Cluster() != nil {
		ch.srv.Platform().Cluster().SendClusterMessage(&model.ClusterMessage{
			Event:            model.ClusterEventInvalidateCacheForSystemSettingPolicies,
			SendType:         model.ClusterSendReliable,
			WaitForAllToSend: true,
		})
	}
}

func (a *App) invalidateSystemSettingPolicyCache() {
	a.Srv().Channels().invalidateSystemSettingPolicyCache()
}

func systemSettingPoliciesEnabled(cfg *model.Config) bool {
	return cfg.FeatureFlags.SystemSettingPolicies &&
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl != nil &&
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl
}

func systemSettingRoleChain(role string, isBot bool) []string {
	chain := make([]string, 0, 3)
	if isBot {
		chain = append(chain, model.AccessControlPolicyRoleSystemBot)
	}
	chain = append(chain, role)
	if role == model.SystemAdminRoleId {
		chain = append(chain, model.SystemUserRoleId)
	}
	return chain
}

// EvaluateClientConfigOverrides evaluates active system_setting policies for
// the session attached to rctx and returns a map of matched ClientConfig keys
// to their serialized override values. Returns an empty map when ABAC or
// SystemSettingPolicies is disabled, unlicensed, or no policy matches.
func (a *App) EvaluateClientConfigOverrides(rctx request.CTX) (map[string]string, *model.AppError) {
	overrides, _, appErr := a.evaluateClientConfigOverrides(rctx)
	return overrides, appErr
}

// evaluateClientConfigOverrides is EvaluateClientConfigOverrides that also
// reports whether any policy targets the session's role chain. When none does,
// the overrides are empty regardless of the session's attributes.
func (a *App) evaluateClientConfigOverrides(rctx request.CTX) (map[string]string, bool, *model.AppError) {
	acs := a.Srv().Channels().AccessControl
	if acs == nil || !systemSettingPoliciesEnabled(a.Config()) || !model.MinimumEnterpriseAdvancedLicense(a.License()) {
		return map[string]string{}, false, nil
	}

	session := rctx.Session()
	if session == nil || session.UserId == "" {
		return map[string]string{}, false, nil
	}

	policies, err := a.Srv().Channels().systemSettingPoliciesCache.Get(rctx, a.Srv().Store().AccessControlPolicy())
	if err != nil {
		return nil, false, model.NewAppError("EvaluateClientConfigOverrides", "app.access_control.evaluate_system_settings.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if len(policies) == 0 {
		return map[string]string{}, false, nil
	}

	systemRole := ResolveSystemRole(session.Roles)
	candidateRoles := systemSettingRoleChain(systemRole, true)
	hasCandidate := false
	for _, p := range policies {
		if len(p.Roles) > 0 && slices.Contains(candidateRoles, p.Roles[0]) {
			hasCandidate = true
			break
		}
	}
	if !hasCandidate {
		return map[string]string{}, false, nil
	}

	subject, appErr := a.BuildAccessControlSubjectForSession(rctx, "")
	if appErr != nil {
		return nil, true, appErr
	}

	roleChain := systemSettingRoleChain(systemRole, subject.IsBot)
	overrides := make(map[string]string)

	for _, p := range policies {
		if len(p.Roles) == 0 || !slices.Contains(roleChain, p.Roles[0]) {
			continue
		}
		for _, rule := range p.Rules {
			def, ok := model.LookupSystemSettingDefinition(rule.Key)
			if !ok || !def.ValidateValue(rule.Value) {
				continue
			}
			if _, exists := overrides[rule.Key]; exists {
				continue
			}

			decision, evalErr := acs.AccessEvaluation(rctx, model.AccessRequest{
				Subject: *subject,
				Resource: model.Resource{
					ID:   p.ID,
					Type: model.AccessControlPolicyTypeSystemSetting,
				},
				Action: rule.Key,
			})
			if evalErr != nil {
				return nil, true, evalErr
			}
			if decision.Decision {
				overrides[rule.Key] = rule.Value
			}
		}
	}

	return overrides, true, nil
}

// validateSystemSettingPolicyOnSave validates system_setting policy invariants
// before persisting: model-level schema/value checks, absence of channel
// resource attribute selectors, and global uniqueness per ClientConfig key.
func (a *App) validateSystemSettingPolicyOnSave(rctx request.CTX, policy *model.AccessControlPolicy) *model.AppError {
	if appErr := policy.IsValid(); appErr != nil {
		return appErr
	}

	requestedKeys := make([]string, 0, len(policy.Rules))
	requestedSet := make(map[string]struct{}, len(policy.Rules))
	for _, rule := range policy.Rules {
		if expressionReferencesResourceRoot(rule.Expression) {
			return model.NewAppError("CreateOrUpdateAccessControlPolicy", "app.pap.save_policy.system_setting_resource_attributes", nil, "system_setting policies cannot reference resource.*", http.StatusBadRequest)
		}
		key := rule.Actions[0]
		requestedKeys = append(requestedKeys, key)
		requestedSet[key] = struct{}{}
	}

	var cursor model.AccessControlPolicyCursor
	for {
		existingPolicies, _, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Type:    model.AccessControlPolicyTypeSystemSetting,
			Actions: requestedKeys,
			Cursor:  cursor,
			Limit:   systemSettingPolicySearchPageSize,
		})
		if err != nil {
			return model.NewAppError("CreateOrUpdateAccessControlPolicy", "app.pap.search_access_control_policies.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		for _, existing := range existingPolicies {
			if existing.ID == policy.ID {
				continue
			}
			for _, r := range existing.Rules {
				for _, action := range r.Actions {
					if _, conflict := requestedSet[action]; conflict {
						return model.NewAppError(
							"CreateOrUpdateAccessControlPolicy",
							"app.pap.save_policy.system_setting_key_exists.app_error",
							map[string]any{"Key": action, "PolicyName": existing.Name},
							"",
							http.StatusBadRequest,
						)
					}
				}
			}
		}

		if len(existingPolicies) < systemSettingPolicySearchPageSize {
			break
		}
		cursor = model.AccessControlPolicyCursor{ID: existingPolicies[len(existingPolicies)-1].ID}
	}

	return nil
}

func (a *App) publishSystemSettingPolicyUpdate(_ request.CTX) {
	messageWs := model.NewWebSocketEvent(model.WebsocketEventSystemSettingPolicyUpdated, "", "", "", nil, "")
	useSystemSettingPolicyHook(messageWs)
	a.Publish(messageWs)
}

// expressionReferencesResourceRoot reports whether expr accesses the top-level
// `resource.<field>` identifier outside string literals.
func expressionReferencesResourceRoot(expr string) bool {
	isIdentPart := func(r rune) bool {
		return unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_'
	}

	runes := []rune(expr)
	n := len(runes)
	var prevNonSpace rune

	for i := 0; i < n; {
		ch := runes[i]
		if ch == '"' || ch == '\'' {
			quote := ch
			i++
			for i < n && runes[i] != quote {
				if runes[i] == '\\' {
					i++
				}
				i++
			}
			if i < n {
				i++
			}
			prevNonSpace = quote
			continue
		}

		if unicode.IsSpace(ch) {
			i++
			continue
		}

		if unicode.IsLetter(ch) || ch == '_' {
			start := i
			for i < n && isIdentPart(runes[i]) {
				i++
			}
			ident := string(runes[start:i])
			if ident == "resource" && prevNonSpace != '.' {
				j := i
				for j < n && unicode.IsSpace(runes[j]) {
					j++
				}
				if j < n && runes[j] == '.' {
					return true
				}
			}
			prevNonSpace = runes[i-1]
			continue
		}

		prevNonSpace = ch
		i++
	}

	return false
}
