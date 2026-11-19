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
	ID       string
	Revision int
	Roles    []string
	Rules    []cachedSystemSettingRule
	// FieldIDs holds every id_<id> token in the expressions, so it can also hold
	// the property group ID.
	FieldIDs            map[string]struct{}
	AnyField            bool
	SessionAttributes   map[string]struct{}
	AnySessionAttribute bool
}

var (
	expressionIDTokenPattern          = regexp.MustCompile(`id_([a-z0-9]{26})`)
	expressionAttributesByNamePattern = regexp.MustCompile(`\buser\s*\.\s*attributes\b`)
	expressionSessionRootPattern      = regexp.MustCompile(`\buser\s*\.\s*session\b`)
	expressionSessionAttributePattern = regexp.MustCompile(`\buser\s*\.\s*session\s*\.\s*([A-Za-z_][A-Za-z0-9_]*)`)
)

// A user.attributes reference counts as reading every field, and a
// user.session reference other than user.session.<name> as reading every
// session attribute.
func (p *cachedSystemSettingPolicy) addExpressionReferences(expr string) {
	for _, match := range expressionIDTokenPattern.FindAllStringSubmatch(expr, -1) {
		p.FieldIDs[match[1]] = struct{}{}
	}
	if expressionAttributesByNamePattern.MatchString(expr) {
		p.AnyField = true
	}

	named := expressionSessionAttributePattern.FindAllStringSubmatch(expr, -1)
	for _, match := range named {
		p.SessionAttributes[match[1]] = struct{}{}
	}
	if len(expressionSessionRootPattern.FindAllStringIndex(expr, -1)) > len(named) {
		p.AnySessionAttribute = true
	}
}

func (p *cachedSystemSettingPolicy) referencesField(fieldIDs []string) bool {
	if p.AnyField && len(fieldIDs) > 0 {
		return true
	}
	for _, id := range fieldIDs {
		if _, ok := p.FieldIDs[id]; ok {
			return true
		}
	}
	return false
}

func (p *cachedSystemSettingPolicy) referencesSessionAttribute(names []string) bool {
	if p.AnySessionAttribute && len(names) > 0 {
		return true
	}
	for _, name := range names {
		if _, ok := p.SessionAttributes[name]; ok {
			return true
		}
	}
	return false
}

func newCachedSystemSettingPolicy(p *model.AccessControlPolicy) cachedSystemSettingPolicy {
	item := cachedSystemSettingPolicy{
		ID:                p.ID,
		Revision:          p.Revision,
		Roles:             slices.Clone(p.Roles),
		Rules:             make([]cachedSystemSettingRule, 0, len(p.Rules)),
		FieldIDs:          map[string]struct{}{},
		SessionAttributes: map[string]struct{}{},
	}
	for _, r := range p.Rules {
		if len(r.Actions) != 1 || r.Expression == "" {
			continue
		}
		item.Rules = append(item.Rules, cachedSystemSettingRule{
			Key:   r.Actions[0],
			Value: r.Value,
		})
		item.addExpressionReferences(r.Expression)
	}
	return item
}

type systemSettingPolicyCacheEntries struct {
	generation uint64
	policies   []cachedSystemSettingPolicy
}

// A Revision of 0 marks the policy deleted.
type systemSettingPolicyChangeRef struct {
	PolicyID string `json:"policy_id"`
	Revision int    `json:"revision"`
}

func (e *systemSettingPolicyCacheEntries) includes(change systemSettingPolicyChangeRef) bool {
	i := slices.IndexFunc(e.policies, func(p cachedSystemSettingPolicy) bool { return p.ID == change.PolicyID })
	if change.Revision == 0 {
		return i < 0
	}
	return i >= 0 && e.policies[i].Revision >= change.Revision
}

// Entries loaded at minGeneration or later were read after change was stored.
type systemSettingPolicyReload struct {
	change        systemSettingPolicyChangeRef
	minGeneration uint64
}

type systemSettingPolicyCache struct {
	entries    atomic.Pointer[systemSettingPolicyCacheEntries]
	group      singleflight.Group
	generation atomic.Uint64
	reload     atomic.Pointer[systemSettingPolicyReload]
}

func newSystemSettingPolicyCache() *systemSettingPolicyCache {
	return &systemSettingPolicyCache{}
}

func (c *systemSettingPolicyCache) Invalidate() {
	c.generation.Add(1)
	c.entries.Store(nil)
}

// A load finishing concurrently with an invalidation can store entries loaded
// before it.
func (c *systemSettingPolicyCache) current() (*systemSettingPolicyCacheEntries, bool) {
	cached := c.entries.Load()
	if cached == nil || cached.generation != c.generation.Load() {
		return nil, false
	}
	return cached, true
}

func (c *systemSettingPolicyCache) Get(rctx request.CTX, policyStore store.AccessControlPolicyStore) ([]cachedSystemSettingPolicy, error) {
	entries, err := c.get(rctx, policyStore)
	if err != nil {
		return nil, err
	}
	return entries.policies, nil
}

// GetIncluding is for callers that must see a change already stored, such as a
// broadcast that can reach this node before the cluster invalidation for it.
// Entries loaded before the change are reloaded once, however many callers
// notice it.
func (c *systemSettingPolicyCache) GetIncluding(rctx request.CTX, policyStore store.AccessControlPolicyStore, change systemSettingPolicyChangeRef) ([]cachedSystemSettingPolicy, error) {
	entries, err := c.get(rctx, policyStore)
	if err != nil {
		return nil, err
	}
	if entries.includes(change) {
		return entries.policies, nil
	}
	// A later change can keep the reloaded entries from including this one.
	if reload := c.reload.Load(); reload != nil && reload.change == change && entries.generation >= reload.minGeneration {
		return entries.policies, nil
	}

	c.reload.Store(&systemSettingPolicyReload{change: change, minGeneration: entries.generation + 1})
	c.generation.CompareAndSwap(entries.generation, entries.generation+1)
	return c.Get(rctx, policyStore)
}

func (c *systemSettingPolicyCache) get(rctx request.CTX, policyStore store.AccessControlPolicyStore) (*systemSettingPolicyCacheEntries, error) {
	if entries, ok := c.current(); ok {
		return entries, nil
	}

	// A reload right after a save must not cache the previous version from a
	// lagging replica.
	bgCtx := store.RequestContextWithMaster(rctx.WithContext(context.WithoutCancel(rctx.Context())))
	gen := c.generation.Load()
	flightKey := fmt.Sprintf("system_setting_policies\x00%d", gen)

	val, err, _ := c.group.Do(flightKey, func() (any, error) {
		if entries, ok := c.current(); ok {
			return entries, nil
		}

		items := []cachedSystemSettingPolicy{}
		var cursor model.AccessControlPolicyCursor
		for {
			policies, loadErr := policyStore.GetByType(bgCtx, model.AccessControlPolicyTypeSystemSetting, cursor, systemSettingPolicySearchPageSize)
			if loadErr != nil {
				return nil, loadErr
			}

			for _, p := range policies {
				items = append(items, newCachedSystemSettingPolicy(p))
			}

			if len(policies) < systemSettingPolicySearchPageSize {
				break
			}
			cursor = model.AccessControlPolicyCursor{ID: policies[len(policies)-1].ID}
		}

		entries := &systemSettingPolicyCacheEntries{generation: gen, policies: items}
		if c.generation.Load() == gen {
			c.entries.Store(entries)
		}
		return entries, nil
	})
	if err != nil {
		return nil, err
	}
	return val.(*systemSettingPolicyCacheEntries), nil
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

// EvaluateClientConfigOverrides returns the ClientConfig overrides for the session attached to rctx.
func (a *App) EvaluateClientConfigOverrides(rctx request.CTX) (map[string]string, *model.AppError) {
	overrides, _, appErr := a.evaluateClientConfigOverrides(rctx)
	return overrides, appErr
}

// The bool reports whether any policy targets the session's role chain.
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

func (a *App) validateSystemSettingPolicyOnSave(rctx request.CTX, policy *model.AccessControlPolicy) *model.AppError {
	if appErr := policy.IsValid(); appErr != nil {
		return appErr
	}

	requestedSet := make(map[string]struct{}, len(policy.Rules))
	for _, rule := range policy.Rules {
		if expressionReferencesResourceRoot(rule.Expression) {
			return model.NewAppError("CreateOrUpdateAccessControlPolicy", "app.pap.save_policy.system_setting_resource_attributes", nil, "system_setting policies cannot reference resource.*", http.StatusBadRequest)
		}
		requestedSet[rule.Actions[0]] = struct{}{}
	}

	// Read the primary so that two saves close together see each other.
	masterCtx := store.RequestContextWithMaster(rctx)
	var cursor model.AccessControlPolicyCursor
	for {
		existingPolicies, err := a.Srv().Store().AccessControlPolicy().GetByType(masterCtx, model.AccessControlPolicyTypeSystemSetting, cursor, systemSettingPolicySearchPageSize)
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

func (a *App) publishSystemSettingPolicyUpdate(targetRoles []string, change *systemSettingPolicyChangeRef) {
	messageWs := model.NewWebSocketEvent(model.WebsocketEventSystemSettingPolicyUpdated, "", "", "", nil, "")
	useSystemSettingPolicyHook(messageWs, targetRoles, change)
	a.Publish(messageWs)
}

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
