// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/require"
)

type TestHelper struct {
	service    *PropertyService
	dbStore    store.Store
	Context    *request.Context
	CPAGroupID string
}

func Setup(tb testing.TB) *TestHelper {
	if testing.Short() {
		tb.SkipNow()
	}
	dbStore := mainHelper.GetStore()
	dbStore.DropAllTables()
	dbStore.MarkSystemRanUnitTests()
	mainHelper.PreloadMigrations()

	return setupTestHelper(dbStore, tb)
}

func setupTestHelper(s store.Store, tb testing.TB) *TestHelper {
	logger := mlog.CreateConsoleTestLogger(tb)
	service, err := New(ServiceConfig{
		PropertyGroupStore: s.PropertyGroup(),
		PropertyFieldStore: s.PropertyField(),
		PropertyValueStore: s.PropertyValue(),
		CallerIDExtractor: func(rctx request.CTX) string {
			if rctx == nil {
				return ""
			}
			callerID, _ := model.CallerIDFromContext(rctx.Context())
			return callerID
		},
		RequestOptionsExtractor: func(rctx request.CTX) model.PropertyRequestOptions {
			if rctx == nil {
				return model.PropertyRequestOptions{}
			}
			return model.PropertyRequestOptionsFromContext(rctx.Context())
		},
	})
	require.NoError(tb, err)

	tb.Cleanup(func() {
		s.Close()
	})

	return &TestHelper{
		service: service,
		dbStore: s,
		Context: request.EmptyContext(logger),
	}
}

// RequestContextWithCallerID adds the caller ID to a request.CTX for access control purposes.
func RequestContextWithCallerID(rctx request.CTX, callerID string) request.CTX {
	ctx := model.WithCallerID(rctx.Context(), callerID)
	return rctx.WithContext(ctx)
}

// RequestContextWithCallerIDAndOptions adds the caller ID and per-call
// declarations to a request.CTX for access control purposes.
func RequestContextWithCallerIDAndOptions(rctx request.CTX, callerID string, options model.PropertyRequestOptions) request.CTX {
	ctx := model.WithCallerID(rctx.Context(), callerID)
	ctx = model.WithPropertyRequestOptions(ctx, options)
	return rctx.WithContext(ctx)
}

// setPluginCheckerForTests sets the plugin checker on the AccessControlHook for testing.
func (ps *PropertyService) setPluginCheckerForTests(pluginChecker PluginChecker) {
	for _, hook := range ps.hooks {
		if ach, ok := hook.(*AccessControlHook); ok {
			ach.setPluginCheckerForTests(pluginChecker)
		}
	}
}

func (h *AccessControlHook) setPluginCheckerForTests(pluginChecker PluginChecker) {
	h.pluginChecker = pluginChecker
}

// setLadderCheckerForTests sets the ladder checker on the AccessControlHook for testing.
func (ps *PropertyService) setLadderCheckerForTests(ladderChecker PropertyLadderChecker) {
	for _, hook := range ps.hooks {
		if ach, ok := hook.(*AccessControlHook); ok {
			ach.setLadderCheckerForTests(ladderChecker)
		}
	}
}

func (h *AccessControlHook) setLadderCheckerForTests(ladderChecker PropertyLadderChecker) {
	h.ladderChecker = ladderChecker
}

// setRoleListerForTests sets the role lister on the AccessControlHook for testing.
func (ps *PropertyService) setRoleListerForTests(roleLister PropertyRoleLister) {
	for _, hook := range ps.hooks {
		if ach, ok := hook.(*AccessControlHook); ok {
			ach.setRoleListerForTests(roleLister)
		}
	}
}

func (h *AccessControlHook) setRoleListerForTests(roleLister PropertyRoleLister) {
	h.roleLister = roleLister
}

// accessControlHookForTests returns the registered AccessControlHook, for
// tests that need to call its unexported methods directly rather than
// through a service call that routes to it.
func (ps *PropertyService) accessControlHookForTests() *AccessControlHook {
	for _, hook := range ps.hooks {
		if ach, ok := hook.(*AccessControlHook); ok {
			return ach
		}
	}
	return nil
}

func (th *TestHelper) RegisterCPAPropertyGroup(tb testing.TB) *TestHelper {
	// Register the CPA group so requiresAccessControl can always look it up
	group, groupErr := th.service.RegisterPropertyGroup(&model.PropertyGroup{Name: model.AccessControlPropertyGroupName, Version: model.PropertyGroupVersionV2})
	require.NoError(tb, groupErr)
	th.CPAGroupID = group.ID

	// Create and register the access control hook now that the group ID is known.
	// The ladder checker defaults to defaultLadderCheckerForTests rather than
	// nil, so a field carrying a real Restrictions object is judged by its
	// tier instead of being denied outright; a test that needs a specific
	// human decision still overrides it with setLadderCheckerForTests.
	hook := NewAccessControlHook(th.service, nil, defaultLadderCheckerForTests, nil, group.ID)
	th.service.AddHook(hook)

	// Production also runs AccessControlAttributeValidationHook.PreCreatePropertyField
	// on this group, which pins PermissionField/PermissionOptions to sysadmin
	// and fills PermissionValues so a converted field never has an unset
	// permission column, the shape decidePropertyFieldPermission expects. The
	// real hook also validates field names against the CEL grammar and
	// auto-IDs options, which many fixtures in this package don't satisfy, so
	// this registers only the column-pinning half.
	th.service.AddHook(newColumnPinningStubHook(group.ID))

	return th
}

// defaultLadderCheckerForTests stands in for the app-layer human decision
// that access_control_permissions_test.go and app/authorization's own tests
// already cover with explicit injected checkers. It treats the fabricated
// caller IDs used across this package as an ordinary member — there is no
// real user or channel membership to check them against — and allows the
// action only when a member satisfies the field's tier, using the same
// ladder comparison production code uses. A test needing an admin or
// sysadmin caller sets its own checker through setLadderCheckerForTests
// rather than this default inferring privilege from a fixture's caller ID.
func defaultLadderCheckerForTests(_ request.CTX, _ string, field *model.PropertyField, action, _ string) bool {
	if field.Permissions == nil {
		return false
	}
	return model.PermissionLevelMember.AtMostAsPermissiveAs(field.Permissions.Restrictions.TierFor(action))
}

// sysadminLadderCheckerForTests is the escape hatch defaultLadderCheckerForTests's
// own doc comment points to: a test whose caller is meant to hold administrator
// standing installs this instead, since the default only clears a tier up to
// member.
func sysadminLadderCheckerForTests(_ request.CTX, _ string, field *model.PropertyField, action, _ string) bool {
	if field.Permissions == nil {
		return false
	}
	return model.PermissionLevelSysadmin.AtMostAsPermissiveAs(field.Permissions.Restrictions.TierFor(action))
}

// columnPinningStubHook stands in for the column-pinning half of
// AccessControlAttributeValidationHook.enforceGroupPermissions, without its
// field-name and option validation, so a field converted to carry
// Permissions still has PermissionField, PermissionOptions and
// PermissionValues set the way a field created through the API always does.
// It skips the managed=admin upgrade: that needs a permission checker the
// harness doesn't build, and no fixture in this package sets that attr.
type columnPinningStubHook struct {
	BasePropertyHook
	managedGroupIDs map[string]struct{}
}

func newColumnPinningStubHook(managedGroupIDs ...string) *columnPinningStubHook {
	ids := make(map[string]struct{}, len(managedGroupIDs))
	for _, id := range managedGroupIDs {
		ids[id] = struct{}{}
	}
	return &columnPinningStubHook{managedGroupIDs: ids}
}

func (h *columnPinningStubHook) isGroupManaged(groupID string) bool {
	_, ok := h.managedGroupIDs[groupID]
	return ok
}

// pinPermissionColumns mirrors enforceGroupPermissions's column pinning:
// PermissionField and PermissionOptions always go to sysadmin, and
// PermissionValues is pinned to sysadmin for an owner-managed field or
// default-filled by object type when unset. A caller-supplied PermissionValues
// is never overwritten.
func (h *columnPinningStubHook) pinPermissionColumns(field *model.PropertyField) *model.PropertyField {
	sysadmin := model.PermissionLevelSysadmin
	switch {
	case model.HasPropertyFieldOwners(field):
		field.PermissionValues = &sysadmin
	case field.PermissionValues == nil:
		defaultLevel := defaultPermissionValuesForObjectType(field.ObjectType)
		field.PermissionValues = &defaultLevel
	}
	field.PermissionField = &sysadmin
	field.PermissionOptions = &sysadmin
	return field
}

func (h *columnPinningStubHook) PreCreatePropertyField(_ request.CTX, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.isGroupManaged(field.GroupID) {
		return field, nil
	}
	return h.pinPermissionColumns(field), nil
}

func (h *columnPinningStubHook) PreUpdatePropertyField(_ request.CTX, groupID string, field *model.PropertyField) (*model.PropertyField, error) {
	if !h.isGroupManaged(groupID) {
		return field, nil
	}
	return h.pinPermissionColumns(field), nil
}

// RegisterPropertyGroup registers a new property group with the given version and a unique name.
func (th *TestHelper) RegisterPropertyGroup(tb testing.TB, version int) *model.PropertyGroup {
	tb.Helper()
	group, err := th.service.RegisterPropertyGroup(&model.PropertyGroup{
		Name:    model.NewId(),
		Version: version,
	})
	require.NoError(tb, err)
	return group
}

// CreateTeam creates a team for testing hierarchy
func (th *TestHelper) CreateTeam(tb testing.TB) *model.Team {
	team := &model.Team{
		DisplayName: "Test Team " + model.NewId(),
		Name:        "team" + model.NewId(),
		Type:        model.TeamOpen,
	}
	team, err := th.dbStore.Team().Save(team)
	require.NoError(tb, err)
	return team
}

// CreateChannel creates a channel in the given team
func (th *TestHelper) CreateChannel(tb testing.TB, teamID string) *model.Channel {
	channel := &model.Channel{
		TeamId:      teamID,
		DisplayName: "Test Channel " + model.NewId(),
		Name:        "channel" + model.NewId(),
		Type:        model.ChannelTypeOpen,
	}
	channel, err := th.dbStore.Channel().Save(th.Context, channel, 10000)
	require.NoError(tb, err)
	return channel
}

// CreateDMChannel creates a DM channel (no team association)
func (th *TestHelper) CreateDMChannel(tb testing.TB) *model.Channel {
	// Create two users for the DM
	user1 := th.CreateUser(tb)
	user2 := th.CreateUser(tb)

	channel, err := th.dbStore.Channel().CreateDirectChannel(th.Context, user1, user2)
	require.NoError(tb, err)
	return channel
}

// CreateUser creates a user for testing
func (th *TestHelper) CreateUser(tb testing.TB) *model.User {
	id := model.NewId()
	user := &model.User{
		Email:         "success+" + id + "@simulator.amazonses.com",
		Username:      "un_" + id,
		Nickname:      "nn_" + id,
		Password:      model.NewTestPassword(),
		EmailVerified: true,
	}
	user, err := th.dbStore.User().Save(th.Context, user)
	require.NoError(tb, err)
	return user
}

// CreatePropertyField creates a property field using the service (with access control routing)
func (th *TestHelper) CreatePropertyField(tb testing.TB, rctx request.CTX, field *model.PropertyField) *model.PropertyField {
	result, err := th.service.CreatePropertyField(rctx, field)
	require.NoError(tb, err)
	return result
}

// CreatePropertyFieldDirect creates a property field directly via store (bypasses conflict check and access control)
func (th *TestHelper) CreatePropertyFieldDirect(tb testing.TB, field *model.PropertyField) *model.PropertyField {
	result, err := th.dbStore.PropertyField().Create(field)
	require.NoError(tb, err)
	return result
}

// CreatePropertyValue creates a property value using the service (with access control routing)
func (th *TestHelper) CreatePropertyValue(tb testing.TB, rctx request.CTX, value *model.PropertyValue) *model.PropertyValue {
	result, err := th.service.CreatePropertyValue(rctx, value)
	require.NoError(tb, err)
	return result
}
