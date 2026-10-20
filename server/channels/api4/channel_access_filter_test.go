// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/stretchr/testify/require"
)

// Endpoints that take a list of channels filter the denied ones out rather than
// refusing the request: asking for a recap over ten channels should still recap the
// nine you can read. That makes them the one family the surface tables cannot
// express, since a partial denial is a 201 with less in it.

type recapAccessFixture struct {
	th *TestHelper
	// denied is consulted at evaluation time, so a test can create its channels
	// after the mock is installed and then decide which of them the policy refuses.
	denied map[string]bool
}

func (f *recapAccessFixture) deny(channelID string) {
	f.denied[channelID] = true
}

// setupRecapChannelAccess governs channel_read_access and refuses whatever the
// fixture's denied set holds when the PDP is consulted. Recaps sit behind their own
// feature flag, which the env var has to set as well -- the config field alone
// leaves the flag at its default and every assertion here passes vacuously.
func setupRecapChannelAccess(t *testing.T) *recapAccessFixture {
	t.Helper()

	t.Setenv("MM_FEATUREFLAGS_ENABLEAIRECAPS", "true")

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
		cfg.FeatureFlags.EnableAIRecaps = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	f := &recapAccessFixture{th: th, denied: map[string]bool{}}

	mockACS := installMockACS(t, th)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return f.denied[req.Resource.ID]
	})).Return(model.AccessDecision{Decision: false}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, nil)

	return f
}

// No Client4 method exists for recaps yet, so the request goes out by hand.
func createRecapRequest(t *testing.T, th *TestHelper, channelIDs []string) (*http.Response, error) {
	t.Helper()

	body, jsonErr := json.Marshal(model.CreateRecapRequest{
		Title:      "policy filter",
		ChannelIds: channelIDs,
		AgentID:    "test-agent-id",
	})
	require.NoError(t, jsonErr)

	res, err := th.Client.DoAPIPost(context.Background(), "/recaps", string(body))
	if res != nil && res.Body != nil {
		defer res.Body.Close()
	}
	return res, err
}

// The created recap row does not carry its channels; CreateRecap passes them to the
// worker in the job payload, so that is where the surviving set is observable.
func recapJobChannelIDs(t *testing.T, th *TestHelper) []string {
	t.Helper()

	jobs, err := th.App.Srv().Store().Job().GetAllByType(th.Context, model.JobTypeRecap)
	require.NoError(t, err)
	require.Len(t, jobs, 1, "exactly one recap job should have been enqueued")

	ids := jobs[0].Data["channel_ids"]
	if ids == "" {
		return []string{}
	}
	return strings.Split(ids, ",")
}

func TestRecapChannelReadAccessDropsDeniedChannels(t *testing.T) {
	f := setupRecapChannelAccess(t)

	allowed := f.th.CreatePublicChannel(t)
	denied := f.th.CreatePublicChannel(t)
	f.deny(denied.Id)

	res, err := createRecapRequest(t, f.th, []string{allowed.Id, denied.Id})
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, res.StatusCode)

	require.Equal(t, []string{allowed.Id}, recapJobChannelIDs(t, f.th),
		"the denied channel must not be recapped, and the allowed one must survive")
}

func TestRecapChannelReadAccessDeniesWhenEveryChannelIsDenied(t *testing.T) {
	f := setupRecapChannelAccess(t)
	f.deny(f.th.BasicChannel.Id)

	res, err := createRecapRequest(t, f.th, []string{f.th.BasicChannel.Id})
	require.Error(t, err)
	require.Equal(t, http.StatusForbidden, res.StatusCode)
	require.True(t, isChannelReadAccessDenial(err, abacDeniedErrorID),
		"nothing survived the filter, so the response must name the channel-access denial rather than fall back to a bare permission error: %v", err)
}

// sidebarAccessFixture governs channel_read_access for the two sidebar payloads that
// carry channel references without carrying the channels themselves: the membership
// list and the sidebar categories. Neither is self-filtering the way the channel list
// is -- a denial suppresses the channel, it does not remove the membership row or
// rewrite the user's categories -- so a client that keeps local channel records will
// render whatever reference survives here.
type sidebarAccessFixture struct {
	th *TestHelper
	// denied is consulted at evaluation time, so a test can pick its channels
	// after the mock is installed.
	denied map[string]bool
}

func (f *sidebarAccessFixture) deny(channelID string) {
	f.denied[channelID] = true
}

func setupSidebarChannelAccess(t *testing.T) *sidebarAccessFixture {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	f := &sidebarAccessFixture{th: th, denied: map[string]bool{}}

	mockACS := installMockACS(t, th)
	mockACS.On("ActionHasPermissionPolicy", mock.Anything, mock.Anything).Return(true, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return f.denied[req.Resource.ID]
	})).Return(model.AccessDecision{Decision: false}, nil)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, nil)

	return f
}

func TestChannelReadAccessFiltersChannelMembersForTeamForUser(t *testing.T) {
	f := setupSidebarChannelAccess(t)
	th := f.th
	f.deny(th.BasicChannel2.Id)

	members, _, err := th.Client.GetChannelMembersForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
	require.NoError(t, err, "a partial denial filters the list rather than refusing the request")

	channelIDs := make([]string, 0, len(members))
	for _, member := range members {
		channelIDs = append(channelIDs, member.ChannelId)
	}

	require.Contains(t, channelIDs, th.BasicChannel.Id, "the readable channel's membership must survive")
	require.NotContains(t, channelIDs, th.BasicChannel2.Id,
		"the membership row outlives the denial, so the handler has to drop it or the client keeps a channel the channel list no longer returns")
}

func TestChannelReadAccessFiltersSidebarCategories(t *testing.T) {
	f := setupSidebarChannelAccess(t)
	th := f.th
	f.deny(th.BasicChannel2.Id)

	categories, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
	require.NoError(t, err)

	var channelIDs []string
	for _, category := range categories.Categories {
		channelIDs = append(channelIDs, category.Channels...)
	}

	require.Contains(t, channelIDs, th.BasicChannel.Id, "the readable channel must still be placed in the sidebar")
	require.NotContains(t, channelIDs, th.BasicChannel2.Id,
		"a denied channel left in a category hands the client a sidebar row for a channel it may not read")
}

// The write paths keep the full membership: the filtered read must not be what a
// category reorder or an add-to-category writes back, or the denial would drop the
// hidden channels from the user's sidebar for good.
func TestChannelReadAccessLeavesStoredSidebarCategoriesIntact(t *testing.T) {
	f := setupSidebarChannelAccess(t)
	th := f.th
	f.deny(th.BasicChannel2.Id)

	_, _, err := th.Client.GetSidebarCategoriesForTeamForUser(context.Background(), th.BasicUser.Id, th.BasicTeam.Id, "")
	require.NoError(t, err)

	stored, appErr := th.App.GetSidebarCategoriesForTeamForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
	require.Nil(t, appErr)

	var channelIDs []string
	for _, category := range stored.Categories {
		channelIDs = append(channelIDs, category.Channels...)
	}
	require.Contains(t, channelIDs, th.BasicChannel2.Id,
		"the denied channel must still be stored in the user's categories so it returns intact once access does")
}

// saveRecapWithChannels stores a completed recap for the basic user with one summary per
// channel, the way the worker leaves it, so a test can apply a policy after the fact.
func saveRecapWithChannels(t *testing.T, th *TestHelper, channelIDs ...string) *model.Recap {
	t.Helper()

	recap, err := th.App.Srv().Store().Recap().SaveRecap(&model.Recap{
		Id:       model.NewId(),
		UserId:   th.BasicUser.Id,
		Title:    "policy filter",
		CreateAt: model.GetMillis(),
		UpdateAt: model.GetMillis(),
		Status:   model.RecapStatusCompleted,
		BotID:    "test-agent-id",
	})
	require.NoError(t, err)

	for _, channelID := range channelIDs {
		require.NoError(t, th.App.Srv().Store().Recap().SaveRecapChannel(&model.RecapChannel{
			Id:            model.NewId(),
			RecapId:       recap.Id,
			ChannelId:     channelID,
			ChannelName:   channelID,
			Highlights:    []string{"highlight from " + channelID},
			SourcePostIds: []string{model.NewId()},
			CreateAt:      model.GetMillis(),
		}))
	}

	return recap
}

func decodeRecapChannelIDs(t *testing.T, res *http.Response) []string {
	t.Helper()
	defer res.Body.Close()

	var recap model.Recap
	require.NoError(t, json.NewDecoder(res.Body).Decode(&recap))

	channelIDs := make([]string, 0, len(recap.Channels))
	for _, channel := range recap.Channels {
		channelIDs = append(channelIDs, channel.ChannelId)
	}
	return channelIDs
}

// A recap is summarized once and stored, so a policy that starts denying a channel
// afterwards has to be applied when the recap is served, not only when it is created.
func TestRecapChannelReadAccessFiltersStoredSummaries(t *testing.T) {
	f := setupRecapChannelAccess(t)

	allowed := f.th.CreatePublicChannel(t)
	denied := f.th.CreatePublicChannel(t)
	recap := saveRecapWithChannels(t, f.th, allowed.Id, denied.Id)
	f.deny(denied.Id)

	t.Run("get recap", func(t *testing.T) {
		res, err := f.th.Client.DoAPIGet(context.Background(), "/recaps/"+recap.Id, "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Equal(t, []string{allowed.Id}, decodeRecapChannelIDs(t, res),
			"the denied channel's summary must not be served, and the allowed one must survive")
	})

	t.Run("mark recap as read", func(t *testing.T) {
		res, err := f.th.Client.DoAPIPost(context.Background(), "/recaps/"+recap.Id+"/read", "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Equal(t, []string{allowed.Id}, decodeRecapChannelIDs(t, res),
			"marking a recap read returns it too, so it must be filtered the same way")
	})

	t.Run("every channel denied", func(t *testing.T) {
		f.deny(allowed.Id)
		t.Cleanup(func() { delete(f.denied, allowed.Id) })

		res, err := f.th.Client.DoAPIGet(context.Background(), "/recaps/"+recap.Id, "")
		require.NoError(t, err, "the recap is still the user's own, so it is returned empty rather than refused")
		require.Equal(t, http.StatusOK, res.StatusCode)
		require.Empty(t, decodeRecapChannelIDs(t, res))
	})

	stored, appErr := f.th.App.GetRecap(f.th.Context, recap.Id)
	require.Nil(t, appErr)
	require.Len(t, stored.Channels, 2,
		"the filter shapes the response only; the summaries must be intact once access returns")
}

// Regenerating re-summarizes the recap's channels, so it is gated like creation.
func TestRecapChannelReadAccessRegenerateDropsDeniedChannels(t *testing.T) {
	f := setupRecapChannelAccess(t)

	allowed := f.th.CreatePublicChannel(t)
	denied := f.th.CreatePublicChannel(t)
	recap := saveRecapWithChannels(t, f.th, allowed.Id, denied.Id)
	f.deny(denied.Id)

	// The seeded recap counts as the last one created, so the default cooldown would
	// refuse the regenerate before it reaches the job.
	f.th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AIRecapSettings.EnforceCooldown = model.NewPointer(false)
	})

	res, err := f.th.Client.DoAPIPost(context.Background(), "/recaps/"+recap.Id+"/regenerate", "")
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, res.StatusCode)
	res.Body.Close()

	require.Equal(t, []string{allowed.Id}, recapJobChannelIDs(t, f.th),
		"the denied channel must not be re-summarized, and the allowed one must survive")
}

func TestRecapChannelReadAccessRegenerateDeniesWhenEveryChannelIsDenied(t *testing.T) {
	f := setupRecapChannelAccess(t)

	denied := f.th.CreatePublicChannel(t)
	recap := saveRecapWithChannels(t, f.th, denied.Id)
	f.deny(denied.Id)

	res, err := f.th.Client.DoAPIPost(context.Background(), "/recaps/"+recap.Id+"/regenerate", "")
	require.Error(t, err)
	require.Equal(t, http.StatusForbidden, res.StatusCode)
	require.True(t, isChannelReadAccessDenial(err, abacDeniedErrorID),
		"nothing survived the filter, so the response must name the channel-access denial: %v", err)

	jobs, jobErr := f.th.App.Srv().Store().Job().GetAllByType(f.th.Context, model.JobTypeRecap)
	require.NoError(t, jobErr)
	require.Empty(t, jobs, "a refused regenerate must not enqueue a job")

	stored, appErr := f.th.App.GetRecap(f.th.Context, recap.Id)
	require.Nil(t, appErr)
	require.Len(t, stored.Channels, 1, "a refused regenerate must not delete the stored summaries")
}
