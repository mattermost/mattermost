// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// deliveryEventCapture routes the test server's audit logger to a temp file bound to the
// audit-delivery level so the REST handlers' delivery records can be asserted end to end.
type deliveryEventCapture struct {
	t    *testing.T
	th   *TestHelper
	path string
}

func startDeliveryEventCapture(t *testing.T, th *TestHelper) *deliveryEventCapture {
	t.Helper()

	path := filepath.Join(t.TempDir(), "delivery-audit.log")
	cfg := mlog.LoggerConfiguration{
		"_testDelivery": mlog.TargetCfg{
			Type:    "file",
			Format:  "json",
			Levels:  []mlog.Level{mlog.LvlAuditDelivery},
			Options: json.RawMessage(fmt.Sprintf(`{"filename":%q}`, path)),
		},
	}
	require.NoError(t, th.App.Srv().Audit.Configure(cfg))

	return &deliveryEventCapture{t: t, th: th, path: path}
}

// postIDs returns the post IDs recorded so far for the given mechanism.
func (c *deliveryEventCapture) postIDs(mechanism string) []string {
	c.t.Helper()
	require.NoError(c.t, c.th.App.Srv().Audit.Flush())

	data, err := os.ReadFile(c.path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	require.NoError(c.t, err)

	var out []string
	for _, line := range splitJSONLines(data) {
		var rec map[string]any
		require.NoError(c.t, json.Unmarshal(line, &rec))
		if rec[model.AuditKeyEventName] != model.AuditEventPostDelivered {
			continue
		}
		meta, ok := rec[model.AuditKeyMeta].(map[string]any)
		require.True(c.t, ok)
		if meta[model.PostDeliveryKeyMechanism] != mechanism {
			continue
		}
		postID, _ := meta[model.PostDeliveryKeyPostID].(string)
		out = append(out, postID)
	}
	return out
}

func splitJSONLines(data []byte) [][]byte {
	var out [][]byte
	start := 0
	for i := range data {
		if data[i] != '\n' {
			continue
		}
		if i > start {
			out = append(out, data[start:i])
		}
		start = i + 1
	}
	if start < len(data) {
		out = append(out, data[start:])
	}
	return out
}

// enableDeliveryTrackingToggle turns the admin toggle on for all eligible channels. The
// feature flag cannot be set this way — FeatureFlags writes through UpdateConfig are discarded
// by the config store — so callers that need the flag must use SetupConfig.
func enableDeliveryTrackingToggle(th *TestHelper) {
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.DeliveryTrackingSettings.Enable = model.NewPointer(true)
		cfg.DeliveryTrackingSettings.EnableForAllChannels = model.NewPointer(true)
	})
}

// setupDeliveryEvents returns a helper with the admin toggle on but the feature flag off, for
// asserting that the flag alone gates emission.
func setupDeliveryEvents(t *testing.T) *TestHelper {
	t.Helper()

	th := Setup(t).InitBasic(t)
	enableDeliveryTrackingToggle(th)

	return th
}

func TestPostDeliveryEventsForRESTReads(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PostDeliveryTracking = true
	}).InitBasic(t)
	enableDeliveryTrackingToggle(th)

	// BasicUser2 reads posts authored by BasicUser, so the self-delivery skip never applies.
	post, _, err := th.Client.CreatePost(context.Background(), &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "tracked message",
	})
	require.NoError(t, err)

	th.LoginBasic2(t)
	client := th.Client

	t.Run("getPostsForChannel", func(t *testing.T) {
		capture := startDeliveryEventCapture(t, th)

		_, _, err := client.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 60, "", false, false)
		require.NoError(t, err)

		require.Contains(t, capture.postIDs(model.DeliveryMechanismProduct), post.Id)
	})

	t.Run("getPost", func(t *testing.T) {
		capture := startDeliveryEventCapture(t, th)

		_, _, err := client.GetPost(context.Background(), post.Id, "")
		require.NoError(t, err)

		require.Equal(t, []string{post.Id}, capture.postIDs(model.DeliveryMechanismProduct))
	})

	t.Run("getPost with a matching etag records nothing", func(t *testing.T) {
		fetched, resp, err := client.GetPost(context.Background(), post.Id, "")
		require.NoError(t, err)
		require.NotNil(t, fetched)
		etag := resp.Etag
		require.NotEmpty(t, etag)

		capture := startDeliveryEventCapture(t, th)
		_, _, err = client.GetPost(context.Background(), post.Id, etag)
		require.NoError(t, err)

		require.Empty(t, capture.postIDs(model.DeliveryMechanismProduct))
	})

	t.Run("getPostThread", func(t *testing.T) {
		capture := startDeliveryEventCapture(t, th)

		_, _, err := client.GetPostThread(context.Background(), post.Id, "", false)
		require.NoError(t, err)

		require.Contains(t, capture.postIDs(model.DeliveryMechanismProduct), post.Id)
	})

	t.Run("getPostsByIds", func(t *testing.T) {
		capture := startDeliveryEventCapture(t, th)

		_, _, err := client.GetPostsByIds(context.Background(), []string{post.Id})
		require.NoError(t, err)

		require.Equal(t, []string{post.Id}, capture.postIDs(model.DeliveryMechanismProduct))
	})

	t.Run("getPinnedPosts", func(t *testing.T) {
		th.LoginBasic(t)
		_, err := th.Client.PinPost(context.Background(), post.Id)
		require.NoError(t, err)
		th.LoginBasic2(t)

		capture := startDeliveryEventCapture(t, th)
		_, _, err = client.GetPinnedPosts(context.Background(), th.BasicChannel.Id, "")
		require.NoError(t, err)

		require.Contains(t, capture.postIDs(model.DeliveryMechanismProduct), post.Id)
	})

	t.Run("records nothing for a DM", func(t *testing.T) {
		dm, _, err := client.CreateDirectChannel(context.Background(), th.BasicUser.Id, th.BasicUser2.Id)
		require.NoError(t, err)

		th.LoginBasic(t)
		dmPost, _, err := th.Client.CreatePost(context.Background(), &model.Post{
			ChannelId: dm.Id,
			Message:   "dm message",
		})
		require.NoError(t, err)
		th.LoginBasic2(t)

		capture := startDeliveryEventCapture(t, th)
		_, _, err = client.GetPost(context.Background(), dmPost.Id, "")
		require.NoError(t, err)

		require.Empty(t, capture.postIDs(model.DeliveryMechanismProduct))
	})
}

func TestPostDeliveryEventsDisabled(t *testing.T) {
	th := setupDeliveryEvents(t)

	post, _, err := th.Client.CreatePost(context.Background(), &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "tracked message",
	})
	require.NoError(t, err)

	th.LoginBasic2(t)

	// The feature flag is off in this helper, so nothing should be recorded even with the
	// admin toggle on.
	require.False(t, th.App.Config().FeatureFlags.PostDeliveryTracking)

	capture := startDeliveryEventCapture(t, th)
	_, _, err = th.Client.GetPost(context.Background(), post.Id, "")
	require.NoError(t, err)

	require.Empty(t, capture.postIDs(model.DeliveryMechanismProduct))
}
