// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"sync/atomic"
	"unicode"

	"golang.org/x/sync/singleflight"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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
	CreateAt int64
	Roles    []string
	Rules    []cachedSystemSettingRule
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

// Get returns every system_setting policy in priority order, highest first.
func (c *systemSettingPolicyCache) Get(rctx request.CTX, st store.Store) ([]cachedSystemSettingPolicy, error) {
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

		policies, searchErr := searchAllSystemSettingPolicies(bgCtx, st.AccessControlPolicy())
		if searchErr != nil {
			return nil, searchErr
		}
		order, orderErr := loadSystemSettingPolicyOrder(st.System())
		if orderErr != nil {
			return nil, orderErr
		}

		items := make([]cachedSystemSettingPolicy, 0, len(policies))
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
				ID:       p.ID,
				CreateAt: p.CreateAt,
				Roles:    slices.Clone(p.Roles),
				Rules:    rules,
			})
		}
		sortSystemSettingPolicies(items, order)

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

func searchAllSystemSettingPolicies(rctx request.CTX, policyStore store.AccessControlPolicyStore) ([]*model.AccessControlPolicy, error) {
	all := []*model.AccessControlPolicy{}
	search := model.AccessControlPolicySearch{
		Type:  model.AccessControlPolicyTypeSystemSetting,
		Limit: systemSettingPolicySearchPageSize,
	}
	for {
		policies, _, err := policyStore.SearchPolicies(rctx, search)
		if err != nil {
			return nil, err
		}
		all = append(all, policies...)
		if len(policies) < systemSettingPolicySearchPageSize {
			return all, nil
		}
		search.Cursor = model.AccessControlPolicyCursor{ID: policies[len(policies)-1].ID}
	}
}

func loadSystemSettingPolicyOrder(systemStore store.SystemStore) ([]string, error) {
	system, err := systemStore.GetByName(model.SystemSystemSettingPolicyOrderKey)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return nil, nil
		}
		return nil, err
	}
	if system.Value == "" {
		return nil, nil
	}
	return strings.Split(system.Value, ","), nil
}

// sortSystemSettingPolicies orders policies by their position in order, then
// places unlisted policies after listed ones by CreateAt and ID.
func sortSystemSettingPolicies(policies []cachedSystemSettingPolicy, order []string) {
	rank := make(map[string]int, len(order))
	for i, id := range order {
		rank[id] = i
	}
	slices.SortStableFunc(policies, func(a, b cachedSystemSettingPolicy) int {
		rankA, listedA := rank[a.ID]
		rankB, listedB := rank[b.ID]
		switch {
		case listedA && listedB:
			return cmp.Compare(rankA, rankB)
		case listedA:
			return -1
		case listedB:
			return 1
		}
		if c := cmp.Compare(a.CreateAt, b.CreateAt); c != 0 {
			return c
		}
		return cmp.Compare(a.ID, b.ID)
	})
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
// to their serialized override values. For each key, the highest-priority
// matching policy supplies the value. Returns an empty map when ABAC or
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

	policies, err := a.Srv().Channels().systemSettingPoliciesCache.Get(rctx, a.Srv().Store())
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
// before persisting: model-level schema/value checks and absence of channel
// resource attribute selectors. Several policies may target the same
// ClientConfig key; the policy order decides which one applies.
func (a *App) validateSystemSettingPolicyOnSave(policy *model.AccessControlPolicy) *model.AppError {
	if appErr := policy.IsValid(); appErr != nil {
		return appErr
	}

	for _, rule := range policy.Rules {
		if expressionReferencesResourceRoot(rule.Expression) {
			return model.NewAppError("CreateOrUpdateAccessControlPolicy", "app.pap.save_policy.system_setting_resource_attributes", nil, "system_setting policies cannot reference resource.*", http.StatusBadRequest)
		}
	}

	return nil
}

// checkSystemSettingPolicyOrderAvailable mirrors the readiness checks the
// policy engine applies when saving a system_setting policy.
func (a *App) checkSystemSettingPolicyOrderAvailable(where string) *model.AppError {
	if a.Srv().Channels().AccessControl == nil {
		return model.NewAppError(where, "app.pap.init.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}
	if !model.MinimumEnterpriseAdvancedLicense(a.License()) {
		return model.NewAppError(where, "app.pap.init.app_error", nil, "enterprise advanced license required", http.StatusNotImplemented)
	}
	if cfg := a.Config(); cfg.AccessControlSettings.EnableAttributeBasedAccessControl == nil || !*cfg.AccessControlSettings.EnableAttributeBasedAccessControl {
		return model.NewAppError(where, "app.pap.is_ready.app_error", nil, "access control is disabled", http.StatusNotAcceptable)
	}
	return nil
}

// GetSystemSettingPolicyOrder returns every system_setting policy ID from
// highest to lowest priority.
func (a *App) GetSystemSettingPolicyOrder(rctx request.CTX) (*model.SystemSettingPolicyOrder, *model.AppError) {
	if appErr := a.checkSystemSettingPolicyOrderAvailable("GetSystemSettingPolicyOrder"); appErr != nil {
		return nil, appErr
	}

	policies, err := a.Srv().Channels().systemSettingPoliciesCache.Get(rctx, a.Srv().Store())
	if err != nil {
		return nil, model.NewAppError("GetSystemSettingPolicyOrder", "app.system_setting_policy_order.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	ids := make([]string, 0, len(policies))
	for _, p := range policies {
		ids = append(ids, p.ID)
	}
	return &model.SystemSettingPolicyOrder{PolicyIDs: ids}, nil
}

// UpdateSystemSettingPolicyOrder stores the priority order of system_setting
// policies, then re-evaluates every connected session's overrides.
func (a *App) UpdateSystemSettingPolicyOrder(rctx request.CTX, order *model.SystemSettingPolicyOrder) (*model.SystemSettingPolicyOrder, *model.AppError) {
	if appErr := a.checkSystemSettingPolicyOrderAvailable("UpdateSystemSettingPolicyOrder"); appErr != nil {
		return nil, appErr
	}
	if appErr := order.IsValid(); appErr != nil {
		return nil, appErr
	}

	policies, err := searchAllSystemSettingPolicies(rctx, a.Srv().Store().AccessControlPolicy())
	if err != nil {
		return nil, model.NewAppError("UpdateSystemSettingPolicyOrder", "app.pap.search_access_control_policies.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	existing := make(map[string]struct{}, len(policies))
	for _, p := range policies {
		existing[p.ID] = struct{}{}
	}
	for _, id := range order.PolicyIDs {
		if _, ok := existing[id]; !ok {
			return nil, model.NewAppError("UpdateSystemSettingPolicyOrder", "app.system_setting_policy_order.unknown_policy.app_error", map[string]any{"PolicyID": id}, "", http.StatusBadRequest)
		}
	}

	if appErr := a.saveSystemSettingPolicyOrder(order.PolicyIDs); appErr != nil {
		return nil, appErr
	}

	a.invalidateSystemSettingPolicyCache()
	a.publishSystemSettingPolicyUpdate(rctx)

	return a.GetSystemSettingPolicyOrder(rctx)
}

func (a *App) saveSystemSettingPolicyOrder(ids []string) *model.AppError {
	if len(ids) == 0 {
		if _, err := a.Srv().Store().System().PermanentDeleteByName(model.SystemSystemSettingPolicyOrderKey); err != nil {
			if _, ok := errors.AsType[*store.ErrNotFound](err); !ok {
				return model.NewAppError("UpdateSystemSettingPolicyOrder", "app.system_setting_policy_order.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}
		return nil
	}

	if err := a.Srv().Store().System().SaveOrUpdate(&model.System{
		Name:  model.SystemSystemSettingPolicyOrderKey,
		Value: strings.Join(ids, ","),
	}); err != nil {
		return model.NewAppError("UpdateSystemSettingPolicyOrder", "app.system_setting_policy_order.save.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

// ensureSystemSettingPolicyInOrder stores the current effective order with
// policyID last when it is not yet listed. AccessControlPolicy.CreateAt moves
// on every revision, so unlisted policies would otherwise shift whenever one
// is edited.
func (a *App) ensureSystemSettingPolicyInOrder(rctx request.CTX, policyID string) {
	order, err := loadSystemSettingPolicyOrder(a.Srv().Store().System())
	if err != nil {
		rctx.Logger().Warn("Failed to load system setting policy order", mlog.String("policy_id", policyID), mlog.Err(err))
		return
	}
	if slices.Contains(order, policyID) {
		return
	}

	policies, err := searchAllSystemSettingPolicies(rctx, a.Srv().Store().AccessControlPolicy())
	if err != nil {
		rctx.Logger().Warn("Failed to load system setting policies to update their order", mlog.String("policy_id", policyID), mlog.Err(err))
		return
	}
	items := make([]cachedSystemSettingPolicy, 0, len(policies))
	for _, p := range policies {
		if p.ID != policyID {
			items = append(items, cachedSystemSettingPolicy{ID: p.ID, CreateAt: p.CreateAt})
		}
	}
	sortSystemSettingPolicies(items, order)

	ids := make([]string, 0, len(items)+1)
	for _, p := range items {
		ids = append(ids, p.ID)
	}
	ids = append(ids, policyID)
	if len(ids) > model.MaxSystemSettingPolicyOrderLength {
		return
	}
	if appErr := a.saveSystemSettingPolicyOrder(ids); appErr != nil {
		rctx.Logger().Warn("Failed to add policy to system setting policy order", mlog.String("policy_id", policyID), mlog.Err(appErr))
	}
}

// removeFromSystemSettingPolicyOrder drops a deleted policy from the stored
// order so the list stays within MaxSystemSettingPolicyOrderLength.
func (a *App) removeFromSystemSettingPolicyOrder(rctx request.CTX, policyID string) {
	order, err := loadSystemSettingPolicyOrder(a.Srv().Store().System())
	if err != nil {
		rctx.Logger().Warn("Failed to load system setting policy order", mlog.String("policy_id", policyID), mlog.Err(err))
		return
	}
	idx := slices.Index(order, policyID)
	if idx < 0 {
		return
	}
	if appErr := a.saveSystemSettingPolicyOrder(slices.Delete(order, idx, idx+1)); appErr != nil {
		rctx.Logger().Warn("Failed to remove deleted policy from system setting policy order", mlog.String("policy_id", policyID), mlog.Err(appErr))
	}
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
