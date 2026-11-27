// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"slices"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// The read-access hooks run once per recipient on the websocket hub. When the publisher
// passes the channel's governance in the hook args, the hook goes straight to the decision
// cache and the PDP, with no channel load and no governance check. These tests run the hooks
// against the real App with a mocked PDP that answers per subject, so allowed and denied
// recipients of one broadcast get different answers.

// hookGovernanceHarness counts what the hooks ask of the store and of the access control
// service.
type hookGovernanceHarness struct {
	*channelReadAccessHarness
	acs *eMocks.AccessControlServiceInterface
	// allow is the PDP's answer for a subject; set it before running a hook.
	allow func(subject model.Subject) bool
	// governanceChecks counts calls to ActionHasPermissionPolicy and ResourcePolicyGovernsAction.
	governanceChecks atomic.Int64
	evaluations      atomic.Int64
	store            *hookCountingStore
}

// setupHookGovernanceTest governs channel read access with a system policy, and has the PDP
// answer each request with h.allow (allow everyone until a test sets it).
func setupHookGovernanceTest(t *testing.T) *hookGovernanceHarness {
	t.Helper()
	return setupHookGovernanceTestWith(t, setupChannelReadAccessTest(t))
}

func setupHookGovernanceTestWith(t *testing.T, ch *channelReadAccessHarness) *hookGovernanceHarness {
	t.Helper()
	h := &hookGovernanceHarness{
		channelReadAccessHarness: ch,
		acs:                      ch.mockACS(t),
		allow:                    func(model.Subject) bool { return true },
	}
	h.acs.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelReadAccess).
		Run(func(mock.Arguments) { h.governanceChecks.Add(1) }).
		Return(true, nil).Maybe()
	h.acs.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(false, nil).Maybe()
	h.acs.On("ResourcePolicyGovernsAction", mock.Anything, mock.Anything, mock.Anything).
		Run(func(mock.Arguments) { h.governanceChecks.Add(1) }).
		Return(false, nil).Maybe()
	h.acs.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(func(_ request.CTX, req model.AccessRequest) (model.AccessDecision, *model.AppError) {
			h.evaluations.Add(1)
			return model.AccessDecision{Decision: h.allow(req.Subject)}, nil
		}).Maybe()

	original := h.th.App.Srv().Store()
	h.store = newHookCountingStore(original)
	h.th.App.Srv().SetStore(h.store)
	t.Cleanup(func() { h.th.App.Srv().SetStore(original) })
	return h
}

// resetCounts zeroes the counters, so a test measures only the hook runs that follow.
func (h *hookGovernanceHarness) resetCounts() {
	h.governanceChecks.Store(0)
	h.evaluations.Store(0)
	h.store.channels.gets.Store(0)
	h.store.policies.actionLookups.Store(0)
}

// session creates a session for userID.
func (h *hookGovernanceHarness) session(t *testing.T, userID string) *model.Session {
	t.Helper()
	session, appErr := h.th.App.CreateSession(h.th.Context, &model.Session{UserId: userID, Props: model.StringMap{}})
	require.Nil(t, appErr)
	return session
}

// conn is a websocket connection of userID, evaluated by the real App. A nil session
// makes a connection that has none.
func (h *hookGovernanceHarness) conn(userID string, session *model.Session) *platform.WebConn {
	wc := &platform.WebConn{
		Platform: h.th.Server.Platform(),
		Suite:    h.th.App,
		UserId:   userID,
	}
	if session != nil {
		wc.SetSession(session)
	}
	return wc
}

// deliver runs the read hook for each connection in order, as the hub does: every recipient
// gets its own hooked view of the same event. It returns whether each one gets the event.
func deliver(t *testing.T, event *model.WebSocketEvent, args map[string]any, conns ...*platform.WebConn) []bool {
	t.Helper()
	delivered := make([]bool, len(conns))
	for i, wc := range conns {
		hooked := platform.MakeHookedWebSocketEvent(event)
		require.NoError(t, (&channelReadAccessBroadcastHook{}).Process(hooked, wc, args))
		delivered[i] = !hooked.Event().IsRejected()
	}
	require.False(t, event.IsRejected(), "a rejection must never reach the shared event")
	return delivered
}

func postedEvent(channelID string) *model.WebSocketEvent {
	return model.NewWebSocketEvent(model.WebsocketEventPosted, "", channelID, "", nil, "")
}

// readHookArgs returns the args a publisher attaches to the read hook for channelID.
func readHookArgs(channelID string, byChannelPolicy *bool) map[string]any {
	event := postedEvent(channelID)
	useChannelReadAccessHook(event, channelID, byChannelPolicy)
	return event.GetBroadcast().BroadcastHookArgs[0]
}

func subjectIs(userIDs ...string) func(model.Subject) bool {
	return func(subject model.Subject) bool { return slices.Contains(userIDs, subject.ID) }
}

func TestChannelReadAccessHookGovernanceArg(t *testing.T) {
	notByChannelPolicy := false

	t.Run("allowed and denied recipients of one event each get their own answer, in either order", func(t *testing.T) {
		h := setupHookGovernanceTest(t)
		h.allow = subjectIs(h.th.BasicUser.Id)
		allowed := h.conn(h.th.BasicUser.Id, h.session(t, h.th.BasicUser.Id))
		denied := h.conn(h.th.BasicUser2.Id, h.session(t, h.th.BasicUser2.Id))
		args := readHookArgs(h.th.BasicChannel.Id, &notByChannelPolicy)

		event := postedEvent(h.th.BasicChannel.Id)
		require.Equal(t, []bool{true, false}, deliver(t, event, args, allowed, denied))
		require.Equal(t, []bool{false, true}, deliver(t, event, args, denied, allowed))
	})

	t.Run("two sessions of one user are decided on their own session attributes", func(t *testing.T) {
		ipName := model.SessionAttributesPropertyFieldIPAddress
		h := setupHookGovernanceTest(t)
		h.allow = func(subject model.Subject) bool { return subject.Session[ipName] == "192.0.2.10" }
		// Enabling session attributes edits their property fields, which notifies the PDP.
		h.acs.On("OnPropertyFieldOptionsChanged", mock.Anything, mock.Anything).Return()
		enableSessionAttributesCollection(t, h.th)

		office := h.session(t, h.th.BasicUser.Id)
		home := h.session(t, h.th.BasicUser.Id)
		h.th.App.ProcessSessionAttributesRequest(h.th.Context.WithSession(office), newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234"))
		h.th.App.ProcessSessionAttributesRequest(h.th.Context.WithSession(home), newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.20:1234"))
		require.Equal(t, "192.0.2.10", sessionAttributeValuesByFieldName(t, h.th, office.Id)[ipName])
		require.Equal(t, "192.0.2.20", sessionAttributeValuesByFieldName(t, h.th, home.Id)[ipName])

		args := readHookArgs(h.th.BasicChannel.Id, &notByChannelPolicy)
		event := postedEvent(h.th.BasicChannel.Id)
		require.Equal(t, []bool{true, false}, deliver(t, event, args,
			h.conn(h.th.BasicUser.Id, office), h.conn(h.th.BasicUser.Id, home)))
		require.Equal(t, []bool{false, true}, deliver(t, event, args,
			h.conn(h.th.BasicUser.Id, home), h.conn(h.th.BasicUser.Id, office)))
	})

	t.Run("a connection without a session is dropped without an evaluation", func(t *testing.T) {
		h := setupHookGovernanceTest(t)
		h.resetCounts()

		args := readHookArgs(h.th.BasicChannel.Id, &notByChannelPolicy)
		require.Equal(t, []bool{false}, deliver(t, postedEvent(h.th.BasicChannel.Id), args, h.conn(h.th.BasicUser.Id, nil)))
		require.Zero(t, h.evaluations.Load())
	})

	t.Run("by_channel_policy decides whether the subject carries the channel role", func(t *testing.T) {
		// The PDP allows only a subject that carries a channel role, as a channel policy's
		// role rule would.
		hasChannelRole := func(subject model.Subject) bool {
			for _, role := range subject.ScopedRoles {
				if role.Scope == model.AccessControlSubjectScopeChannel {
					return true
				}
			}
			return false
		}
		for _, byChannelPolicy := range []bool{true, false} {
			h := setupHookGovernanceTest(t)
			h.allow = hasChannelRole
			args := readHookArgs(h.th.BasicChannel.Id, &byChannelPolicy)
			got := deliver(t, postedEvent(h.th.BasicChannel.Id), args, h.conn(h.th.BasicUser.Id, h.session(t, h.th.BasicUser.Id)))
			require.Equal(t, []bool{byChannelPolicy}, got, "by_channel_policy=%v", byChannelPolicy)
		}
	})
}

// channelWithOwnPolicy creates a channel with a policy of its own, so PolicyEnforced is set
// and loading it through the hydrating GetChannel would read the policy's actions.
func channelWithOwnPolicy(t *testing.T, h *channelReadAccessHarness) *model.Channel {
	t.Helper()
	channel := h.th.CreateChannel(t, h.th.BasicTeam)
	h.th.AddUserToChannel(t, h.th.BasicUser2, channel)
	_, err := h.th.App.Srv().Store().AccessControlPolicy().Save(h.rctx, &model.AccessControlPolicy{
		ID:       channel.Id,
		Type:     model.AccessControlPolicyTypeChannel,
		Name:     "policy-" + channel.Id,
		Active:   true,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_3,
		Imports:  []string{},
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{model.AccessControlPolicyActionMembership}, Expression: "true"},
		},
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = h.th.App.Srv().Store().AccessControlPolicy().Delete(h.rctx, channel.Id) })
	h.th.App.Srv().Store().Channel().InvalidateChannel(channel.Id)

	loaded, err := h.th.App.Srv().Store().Channel().Get(channel.Id, false)
	require.NoError(t, err)
	require.True(t, loaded.PolicyEnforced, "precondition: the channel has a policy of its own")
	return loaded
}

// setupHookStoreCountingTest returns a channel with a policy of its own and two connections:
// BasicUser, whom the PDP allows, then BasicUser2, whom it denies. The counters start at zero.
func setupHookStoreCountingTest(t *testing.T) (*hookGovernanceHarness, *model.Channel, []*platform.WebConn) {
	t.Helper()
	ch := setupChannelReadAccessTest(t)
	channel := channelWithOwnPolicy(t, ch)
	h := setupHookGovernanceTestWith(t, ch)
	h.allow = subjectIs(h.th.BasicUser.Id)
	conns := []*platform.WebConn{
		h.conn(h.th.BasicUser.Id, h.session(t, h.th.BasicUser.Id)),
		h.conn(h.th.BasicUser2.Id, h.session(t, h.th.BasicUser2.Id)),
	}
	h.resetCounts()
	return h, channel, conns
}

func TestChannelReadAccessHookLoadsNoChannelWithGovernanceArg(t *testing.T) {
	setup := setupHookStoreCountingTest
	notByChannelPolicy := false

	t.Run("with the arg", func(t *testing.T) {
		h, channel, conns := setup(t)
		require.Equal(t, []bool{true, false}, deliver(t, postedEvent(channel.Id), readHookArgs(channel.Id, &notByChannelPolicy), conns...))
		require.Zero(t, h.store.channels.gets.Load(), "no channel load")
		require.Zero(t, h.store.policies.actionLookups.Load(), "no policy action lookup")
		require.Zero(t, h.governanceChecks.Load(), "no governance check")
		require.Equal(t, int64(2), h.evaluations.Load())
	})

	t.Run("without the arg it falls back to loading the channel", func(t *testing.T) {
		h, channel, conns := setup(t)
		require.Equal(t, []bool{true, false}, deliver(t, postedEvent(channel.Id), readHookArgs(channel.Id, nil), conns...))
		require.Positive(t, h.store.channels.gets.Load(), "the fallback loads the channel")
		require.Positive(t, h.governanceChecks.Load(), "the fallback decides governance")
		// The fallback's channel read is the bare one: the checks never read the policy's actions.
		require.Zero(t, h.store.policies.actionLookups.Load())
	})
}

func TestChannelReadAccessHookArgsSurviveTheCluster(t *testing.T) {
	h := setupHookGovernanceTest(t)
	notByChannelPolicy := false

	// A peer node receives the event as JSON, so the args arrive decoded with no type
	// information.
	event := postedEvent(h.th.BasicChannel.Id)
	useChannelReadAccessHook(event, h.th.BasicChannel.Id, &notByChannelPolicy)
	data, err := event.ToJSON()
	require.NoError(t, err)
	received, err := model.WebSocketEventFromJSON(bytes.NewReader(data))
	require.NoError(t, err)
	args := received.GetBroadcast().BroadcastHookArgs[0]
	require.Contains(t, args, channelReadAccessArgByChannelPolicy)

	conn := h.conn(h.th.BasicUser.Id, h.session(t, h.th.BasicUser.Id))
	h.resetCounts()
	require.Equal(t, []bool{true}, deliver(t, received, args, conn))
	require.Zero(t, h.store.channels.gets.Load(), "the governed path, not the fallback")
	require.Zero(t, h.governanceChecks.Load())
	require.Equal(t, int64(1), h.evaluations.Load())
}

func TestChannelReadAccessHookSharesDecisionsWithRequests(t *testing.T) {
	h := setupHookGovernanceTest(t)
	session := h.session(t, h.th.BasicUser.Id)
	h.resetCounts()

	// A request in the channel, then the hook for the same session: one evaluation.
	require.True(t, h.th.App.HasChannelReadAccess(h.th.Context.WithSession(session), h.th.BasicUser.Id, h.th.BasicChannel))
	require.Equal(t, int64(1), h.evaluations.Load())

	notByChannelPolicy := false
	require.Equal(t, []bool{true}, deliver(t, postedEvent(h.th.BasicChannel.Id),
		readHookArgs(h.th.BasicChannel.Id, &notByChannelPolicy), h.conn(h.th.BasicUser.Id, session)))
	require.Equal(t, int64(1), h.evaluations.Load(), "the hook is served the request's cached decision")
}

// hookCountingStore counts the channel loads and policy action lookups the hooks make.
type hookCountingStore struct {
	store.Store
	channels *hookCountingChannelStore
	policies *hookCountingPolicyStore
}

func newHookCountingStore(inner store.Store) *hookCountingStore {
	return &hookCountingStore{
		Store:    inner,
		channels: &hookCountingChannelStore{ChannelStore: inner.Channel()},
		policies: &hookCountingPolicyStore{AccessControlPolicyStore: inner.AccessControlPolicy()},
	}
}

func (s *hookCountingStore) Channel() store.ChannelStore { return s.channels }

func (s *hookCountingStore) AccessControlPolicy() store.AccessControlPolicyStore { return s.policies }

type hookCountingChannelStore struct {
	store.ChannelStore
	gets atomic.Int64
}

func (s *hookCountingChannelStore) Get(id string, allowFromCache bool) (*model.Channel, error) {
	s.gets.Add(1)
	return s.ChannelStore.Get(id, allowFromCache)
}

type hookCountingPolicyStore struct {
	store.AccessControlPolicyStore
	actionLookups atomic.Int64
}

func (s *hookCountingPolicyStore) GetActionsForPolicy(rctx request.CTX, policyID string) (map[string]bool, error) {
	s.actionLookups.Add(1)
	return s.AccessControlPolicyStore.GetActionsForPolicy(rctx, policyID)
}
