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
		cfg.FeatureFlags.ChannelAccessABACPermission = true
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
