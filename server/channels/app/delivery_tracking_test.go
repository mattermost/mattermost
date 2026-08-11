// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// deliveryAuditCapture routes the test server's audit logger to a temp file bound to the
// audit-delivery level, so tests can assert on the records the emission helpers produce.
type deliveryAuditCapture struct {
	t    *testing.T
	th   *TestHelper
	path string
}

func startDeliveryAuditCapture(t *testing.T, th *TestHelper) *deliveryAuditCapture {
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

	return &deliveryAuditCapture{t: t, th: th, path: path}
}

// records returns every postDelivered record logged so far.
func (c *deliveryAuditCapture) records() []map[string]any {
	c.t.Helper()
	require.NoError(c.t, c.th.App.Srv().Audit.Flush())

	data, err := os.ReadFile(c.path)
	if errors.Is(err, os.ErrNotExist) {
		// The file target creates the log lazily on first write.
		return nil
	}
	require.NoError(c.t, err)

	var out []map[string]any
	for line := range bytesLines(data) {
		var rec map[string]any
		require.NoError(c.t, json.Unmarshal(line, &rec))
		if rec[model.AuditKeyEventName] == model.AuditEventPostDelivered {
			out = append(out, rec)
		}
	}
	return out
}

func (c *deliveryAuditCapture) requireNone() {
	c.t.Helper()
	require.Empty(c.t, c.records())
}

// requireOne asserts exactly one record was emitted and returns its actor user ID and meta.
func (c *deliveryAuditCapture) requireOne() (string, map[string]any) {
	c.t.Helper()

	records := c.records()
	require.Len(c.t, records, 1)
	return auditActorUserID(c.t, records[0]), auditMeta(c.t, records[0])
}

func auditActorUserID(t *testing.T, rec map[string]any) string {
	t.Helper()

	actor, ok := rec[model.AuditKeyActor].(map[string]any)
	require.True(t, ok, "audit record has no actor")
	userID, _ := actor["user_id"].(string)
	return userID
}

func auditMeta(t *testing.T, rec map[string]any) map[string]any {
	t.Helper()

	meta, ok := rec[model.AuditKeyMeta].(map[string]any)
	require.True(t, ok, "audit record has no meta")
	return meta
}

// setupDeliveryTracking returns a test helper with post delivery audit logging on for all
// eligible channels. The feature flag has to be set when the config store is built: writes to
// FeatureFlags through UpdateConfig are discarded by the store's read-only feature flag
// handling.
func setupDeliveryTracking(t *testing.T) *TestHelper {
	t.Helper()

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PostDeliveryTracking = true
	}).InitBasic(t)

	enableDeliveryTracking(th)
	return th
}

// enableDeliveryTracking turns the admin toggle on for all eligible channels.
func enableDeliveryTracking(th *TestHelper) {
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.DeliveryTrackingSettings.Enable = model.NewPointer(true)
		cfg.DeliveryTrackingSettings.EnableForAllChannels = model.NewPointer(true)
	})
}

// trackOnlyChannels narrows tracking to channelIDs for the duration of the test.
func trackOnlyChannels(t *testing.T, th *TestHelper, channelIDs ...string) {
	t.Helper()

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.DeliveryTrackingSettings.EnableForAllChannels = model.NewPointer(false)
	})
	require.NoError(t, th.App.Srv().Store().DeliveryTracking().SaveTrackedChannelIDs(th.Context, channelIDs))

	t.Cleanup(func() {
		require.NoError(t, th.App.Srv().Store().DeliveryTracking().SaveTrackedChannelIDs(th.Context, nil))
		enableDeliveryTracking(th)
	})
}

func TestDeliveryTrackingEnabled(t *testing.T) {
	t.Run("off by default", func(t *testing.T) {
		th := Setup(t)
		require.False(t, th.App.deliveryTrackingEnabled())
	})

	t.Run("requires the feature flag", func(t *testing.T) {
		th := Setup(t)
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.DeliveryTrackingSettings.Enable = model.NewPointer(true)
		})
		require.False(t, th.App.Config().FeatureFlags.PostDeliveryTracking)
		require.False(t, th.App.deliveryTrackingEnabled())
	})

	t.Run("requires the admin toggle", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.PostDeliveryTracking = true
		})
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.DeliveryTrackingSettings.Enable = model.NewPointer(false)
		})
		require.False(t, th.App.deliveryTrackingEnabled())
	})

	t.Run("on with both", func(t *testing.T) {
		th := setupDeliveryTracking(t)
		require.True(t, th.App.deliveryTrackingEnabled())
	})
}

func TestShouldTrackPost(t *testing.T) {
	testCases := []struct {
		name     string
		post     *model.Post
		expected bool
	}{
		{"nil post", nil, false},
		{"no id", &model.Post{ChannelId: model.NewId()}, false},
		{"regular post", &model.Post{Id: model.NewId()}, true},
		{"system message", &model.Post{Id: model.NewId(), Type: model.PostTypeJoinChannel}, false},
		{"burn on read", &model.Post{Id: model.NewId(), Type: model.PostTypeBurnOnRead}, false},
		{"ephemeral", &model.Post{Id: model.NewId(), Type: model.PostTypeEphemeral}, false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, shouldTrackPost(tc.post))
		})
	}
}

func TestRecordPostDelivery(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PostDeliveryTracking = true
	}).InitBasic(t)

	t.Run("emits nothing when disabled", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPostDelivery(th.Context, th.BasicUser2.Id, th.BasicPost, model.DeliveryMechanismProduct)
		capture.requireNone()
	})

	enableDeliveryTracking(th)

	t.Run("records the recipient as actor with the post payload", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPostDelivery(th.Context, th.BasicUser2.Id, th.BasicPost, model.DeliveryMechanismProduct)

		actorUserID, meta := capture.requireOne()
		require.Equal(t, th.BasicUser2.Id, actorUserID)
		require.Equal(t, th.BasicPost.Id, meta[model.PostDeliveryKeyPostID])
		require.Equal(t, th.BasicPost.ChannelId, meta[model.PostDeliveryKeyChannelID])
		require.Equal(t, model.DeliveryMechanismProduct, meta[model.PostDeliveryKeyMechanism])
		require.NotContains(t, meta, model.PostDeliveryKeyPluginID)
		require.NotContains(t, meta, model.PostDeliveryKeyViaPostID)
	})

	t.Run("skips the post author", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPostDelivery(th.Context, th.BasicPost.UserId, th.BasicPost, model.DeliveryMechanismProduct)
		capture.requireNone()
	})

	t.Run("skips an empty recipient", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPostDelivery(th.Context, "", th.BasicPost, model.DeliveryMechanismProduct)
		capture.requireNone()
	})

	t.Run("skips system messages", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		systemPost := th.CreatePost(t, th.BasicChannel)
		systemPost.Type = model.PostTypeJoinChannel

		th.App.RecordPostDelivery(th.Context, th.BasicUser2.Id, systemPost, model.DeliveryMechanismProduct)
		capture.requireNone()
	})

	t.Run("skips burn on read posts", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		borPost := th.CreatePost(t, th.BasicChannel)
		borPost.Type = model.PostTypeBurnOnRead

		th.App.RecordPostDelivery(th.Context, th.BasicUser2.Id, borPost, model.DeliveryMechanismProduct)
		capture.requireNone()
	})

	t.Run("skips DMs", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		dm, appErr := th.App.GetOrCreateDirectChannel(th.Context, th.BasicUser.Id, th.BasicUser2.Id)
		require.Nil(t, appErr)
		dmPost := th.CreatePost(t, dm)

		th.App.RecordPostDelivery(th.Context, th.BasicUser2.Id, dmPost, model.DeliveryMechanismProduct)
		capture.requireNone()
	})

	t.Run("honours the tracked channel list", func(t *testing.T) {
		otherChannel := th.CreateChannel(t, th.BasicTeam)
		otherPost := th.CreatePost(t, otherChannel)

		trackOnlyChannels(t, th, th.BasicChannel.Id)

		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPostDelivery(th.Context, th.BasicUser2.Id, otherPost, model.DeliveryMechanismProduct)
		capture.requireNone()

		th.App.RecordPostDelivery(th.Context, th.BasicUser2.Id, th.BasicPost, model.DeliveryMechanismProduct)
		_, meta := capture.requireOne()
		require.Equal(t, th.BasicPost.Id, meta[model.PostDeliveryKeyPostID])
	})
}

func TestRecordPostsDelivery(t *testing.T) {
	th := setupDeliveryTracking(t)

	t.Run("one record per post", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		posts := []*model.Post{
			th.CreatePost(t, th.BasicChannel),
			th.CreatePost(t, th.BasicChannel),
			th.CreatePost(t, th.BasicChannel),
		}

		th.App.RecordPostsDelivery(th.Context, th.BasicUser2.Id, posts, model.DeliveryMechanismProduct)

		records := capture.records()
		require.Len(t, records, len(posts))
		for i, rec := range records {
			require.Equal(t, th.BasicUser2.Id, auditActorUserID(t, rec))
			require.Equal(t, posts[i].Id, auditMeta(t, rec)[model.PostDeliveryKeyPostID])
		}
	})

	t.Run("skips nils, system messages and the recipient's own post", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		// BasicUser2 is the recipient, so their own post must not produce a record.
		authoredByRecipient := th.CreatePost(t, th.BasicChannel, func(post *model.Post) {
			post.UserId = th.BasicUser2.Id
		})
		systemPost := th.CreatePost(t, th.BasicChannel)
		systemPost.Type = model.PostTypeJoinChannel
		tracked := th.CreatePost(t, th.BasicChannel)

		th.App.RecordPostsDelivery(th.Context, th.BasicUser2.Id,
			[]*model.Post{nil, authoredByRecipient, systemPost, tracked}, model.DeliveryMechanismProduct)

		records := capture.records()
		require.Len(t, records, 1)
		require.Equal(t, tracked.Id, auditMeta(t, records[0])[model.PostDeliveryKeyPostID])
	})

	t.Run("empty input emits nothing", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPostsDelivery(th.Context, th.BasicUser2.Id, nil, model.DeliveryMechanismProduct)
		capture.requireNone()
	})
}

func TestRecordPostListDelivery(t *testing.T) {
	th := setupDeliveryTracking(t)

	t.Run("records every post in order", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		first := th.CreatePost(t, th.BasicChannel)
		second := th.CreatePost(t, th.BasicChannel)

		list := model.NewPostList()
		list.AddPost(first)
		list.AddOrder(first.Id)
		list.AddPost(second)
		list.AddOrder(second.Id)

		th.App.RecordPostListDelivery(th.Context, th.BasicUser2.Id, list, model.DeliveryMechanismProduct)

		records := capture.records()
		require.Len(t, records, 2)
		require.Equal(t, first.Id, auditMeta(t, records[0])[model.PostDeliveryKeyPostID])
		require.Equal(t, second.Id, auditMeta(t, records[1])[model.PostDeliveryKeyPostID])
	})

	t.Run("nil and empty lists emit nothing", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPostListDelivery(th.Context, th.BasicUser2.Id, nil, model.DeliveryMechanismProduct)
		th.App.RecordPostListDelivery(th.Context, th.BasicUser2.Id, model.NewPostList(), model.DeliveryMechanismProduct)
		capture.requireNone()
	})
}

func TestRecordPermalinkPreviewDelivery(t *testing.T) {
	th := setupDeliveryTracking(t)

	t.Run("carries the containing post as via_", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		containingChannel := th.CreateChannel(t, th.BasicTeam)
		containing := th.CreatePost(t, containingChannel)

		th.App.RecordPermalinkPreviewDelivery(th.Context, th.BasicUser2.Id, th.BasicPost, containing)

		actorUserID, meta := capture.requireOne()
		require.Equal(t, th.BasicUser2.Id, actorUserID)
		require.Equal(t, th.BasicPost.Id, meta[model.PostDeliveryKeyPostID])
		require.Equal(t, th.BasicPost.ChannelId, meta[model.PostDeliveryKeyChannelID])
		require.Equal(t, model.DeliveryMechanismPermalinkPreview, meta[model.PostDeliveryKeyMechanism])
		require.Equal(t, containing.Id, meta[model.PostDeliveryKeyViaPostID])
		require.Equal(t, containingChannel.Id, meta[model.PostDeliveryKeyViaChannelID])
	})

	t.Run("previewed channel governs, not the containing one", func(t *testing.T) {
		untracked := th.CreateChannel(t, th.BasicTeam)
		containing := th.CreatePost(t, untracked)

		trackOnlyChannels(t, th, th.BasicChannel.Id)

		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPermalinkPreviewDelivery(th.Context, th.BasicUser2.Id, th.BasicPost, containing)

		_, meta := capture.requireOne()
		require.Equal(t, th.BasicPost.Id, meta[model.PostDeliveryKeyPostID])
		require.Equal(t, untracked.Id, meta[model.PostDeliveryKeyViaChannelID])
	})

	t.Run("skips a previewed post in an untracked channel", func(t *testing.T) {
		untracked := th.CreateChannel(t, th.BasicTeam)
		previewed := th.CreatePost(t, untracked)

		trackOnlyChannels(t, th, th.BasicChannel.Id)

		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPermalinkPreviewDelivery(th.Context, th.BasicUser2.Id, previewed, th.BasicPost)
		capture.requireNone()
	})
}

// TestSanitizePostMetadataForUserRecordsPreviewDelivery drives the real permalink preview
// path, rather than the record helper in isolation.
func TestSanitizePostMetadataForUserRecordsPreviewDelivery(t *testing.T) {
	th := setupDeliveryTracking(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
		*cfg.ServiceSettings.EnablePermalinkPreviews = true
	})
	th.Context.Session().UserId = th.BasicUser.Id

	previewed, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "previewed message",
	}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)
	previewed.Metadata.Embeds = nil

	containingChannel := th.CreateChannel(t, th.BasicTeam)
	th.AddUserToChannel(t, th.BasicUser2, containingChannel)

	link := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, previewed.Id)
	containing, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: containingChannel.Id,
		Message:   link,
	}, containingChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)
	containing.Metadata.Embeds = nil

	clientPost := th.App.PreparePostForClientWithEmbedsAndImages(th.Context, containing, &model.PreparePostForClientOpts{})
	require.NotNil(t, clientPost.GetPreviewPost(), "the permalink preview must be embedded for this test to be meaningful")

	capture := startDeliveryAuditCapture(t, th)
	_, _, appErr = th.App.SanitizePostMetadataForUser(th.Context, clientPost, th.BasicUser2.Id)
	require.Nil(t, appErr)

	records := capture.records()
	require.Len(t, records, 1)

	meta := auditMeta(t, records[0])
	require.Equal(t, th.BasicUser2.Id, auditActorUserID(t, records[0]))
	require.Equal(t, previewed.Id, meta[model.PostDeliveryKeyPostID])
	require.Equal(t, th.BasicChannel.Id, meta[model.PostDeliveryKeyChannelID])
	require.Equal(t, model.DeliveryMechanismPermalinkPreview, meta[model.PostDeliveryKeyMechanism])
	require.Equal(t, containing.Id, meta[model.PostDeliveryKeyViaPostID])
	require.Equal(t, containingChannel.Id, meta[model.PostDeliveryKeyViaChannelID])
}

// TestCreatePostWithPermalinkRecordsPreviewForAuthor pins that posting a permalink records the
// poster as having seen the previewed post: CreatePost sanitizes the new post for its own author,
// which is where the preview embed is resolved for them.
func TestCreatePostWithPermalinkRecordsPreviewForAuthor(t *testing.T) {
	th := setupDeliveryTracking(t)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.SiteURL = "http://mymattermost.com"
		*cfg.ServiceSettings.EnablePermalinkPreviews = true
	})

	// Authored by BasicUser2 so the poster is not the previewed post's author.
	previewed, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser2.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "previewed message",
	}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	th.Context.Session().UserId = th.BasicUser.Id
	link := fmt.Sprintf("%s/%s/pl/%s", *th.App.Config().ServiceSettings.SiteURL, th.BasicTeam.Name, previewed.Id)

	capture := startDeliveryAuditCapture(t, th)
	containing, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   link,
	}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)
	require.NotNil(t, containing.GetPreviewPost(), "the permalink preview must be embedded for this test to be meaningful")

	var previewRecord map[string]any
	for _, rec := range capture.records() {
		meta := auditMeta(t, rec)
		if meta[model.PostDeliveryKeyMechanism] != model.DeliveryMechanismPermalinkPreview {
			continue
		}
		require.Equal(t, th.BasicUser.Id, auditActorUserID(t, rec))
		previewRecord = meta
		break
	}

	require.NotNil(t, previewRecord, "expected the poster to be recorded for the previewed post")
	require.Equal(t, previewed.Id, previewRecord[model.PostDeliveryKeyPostID])
	require.Equal(t, th.BasicChannel.Id, previewRecord[model.PostDeliveryKeyChannelID])
	require.Equal(t, containing.Id, previewRecord[model.PostDeliveryKeyViaPostID])
	require.Equal(t, th.BasicChannel.Id, previewRecord[model.PostDeliveryKeyViaChannelID])
}

// TestShouldTrackChannelIsAllocationFree guards the hot path: once the channel eligibility memo is
// warm, the per-delivery check must not allocate.
func TestShouldTrackChannelIsAllocationFree(t *testing.T) {
	th := setupDeliveryTracking(t)

	t.Run("all channels", func(t *testing.T) {
		require.True(t, th.App.shouldTrackChannel(th.Context, th.BasicChannel.Id))

		allocs := testing.AllocsPerRun(200, func() {
			th.App.shouldTrackChannel(th.Context, th.BasicChannel.Id)
		})
		require.Zero(t, allocs)
	})

	t.Run("explicit channel list", func(t *testing.T) {
		trackOnlyChannels(t, th, th.BasicChannel.Id)
		require.True(t, th.App.shouldTrackChannel(th.Context, th.BasicChannel.Id))

		allocs := testing.AllocsPerRun(200, func() {
			th.App.shouldTrackChannel(th.Context, th.BasicChannel.Id)
		})
		require.Zero(t, allocs)
	})
}

func TestRecordBroadcastDelivery(t *testing.T) {
	th := setupDeliveryTracking(t)

	marker := &model.PostDeliveryMarker{
		PostId:    th.BasicPost.Id,
		ChannelId: th.BasicPost.ChannelId,
		UserId:    th.BasicPost.UserId,
	}

	t.Run("records without resolving the channel", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordBroadcastDelivery(marker, th.BasicUser2.Id)

		actorUserID, meta := capture.requireOne()
		require.Equal(t, th.BasicUser2.Id, actorUserID)
		require.Equal(t, marker.PostId, meta[model.PostDeliveryKeyPostID])
		require.Equal(t, marker.ChannelId, meta[model.PostDeliveryKeyChannelID])
		require.Equal(t, model.DeliveryMechanismPostBroadcast, meta[model.PostDeliveryKeyMechanism])
	})

	t.Run("skips the author's own echo", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordBroadcastDelivery(marker, marker.UserId)
		capture.requireNone()
	})

	t.Run("skips a nil marker and an empty user", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordBroadcastDelivery(nil, th.BasicUser2.Id)
		th.App.RecordBroadcastDelivery(marker, "")
		capture.requireNone()
	})
}

func TestMarkPostDeliveryForBroadcast(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PostDeliveryTracking = true
	}).InitBasic(t)

	newEvent := func() *model.WebSocketEvent {
		return model.NewWebSocketEvent(model.WebsocketEventPosted, "", th.BasicChannel.Id, "", nil, "")
	}

	t.Run("no marker when disabled", func(t *testing.T) {
		event := newEvent()
		th.App.markPostDeliveryForBroadcast(th.Context, event, th.BasicPost)
		require.Nil(t, event.GetBroadcast().RecordPostDelivery)
	})

	enableDeliveryTracking(th)

	t.Run("marker carries the post, channel and author", func(t *testing.T) {
		event := newEvent()
		th.App.markPostDeliveryForBroadcast(th.Context, event, th.BasicPost)

		marker := event.GetBroadcast().RecordPostDelivery
		require.NotNil(t, marker)
		require.Equal(t, th.BasicPost.Id, marker.PostId)
		require.Equal(t, th.BasicPost.ChannelId, marker.ChannelId)
		require.Equal(t, th.BasicPost.UserId, marker.UserId)
	})

	t.Run("no marker for a system message", func(t *testing.T) {
		systemPost := th.CreatePost(t, th.BasicChannel)
		systemPost.Type = model.PostTypeJoinChannel

		event := newEvent()
		th.App.markPostDeliveryForBroadcast(th.Context, event, systemPost)
		require.Nil(t, event.GetBroadcast().RecordPostDelivery)
	})
}

func TestRecordPostDeliveryToIntegrations(t *testing.T) {
	th := setupDeliveryTracking(t)

	t.Run("plugin delivery has no actor and carries plugin_id", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPostDeliveryToPlugin(th.Context, "com.example.plugin", th.BasicPost)

		actorUserID, meta := capture.requireOne()
		require.Empty(t, actorUserID)
		require.Equal(t, "com.example.plugin", meta[model.PostDeliveryKeyPluginID])
		require.Equal(t, model.DeliveryMechanismPlugin, meta[model.PostDeliveryKeyMechanism])
	})

	t.Run("plugin delivery is recorded even for the post author's own plugin post", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPostDeliveryToPlugins(th.Context, []string{"plugin.a", "plugin.b", ""}, th.BasicPost)

		records := capture.records()
		require.Len(t, records, 2)
		require.Equal(t, "plugin.a", auditMeta(t, records[0])[model.PostDeliveryKeyPluginID])
		require.Equal(t, "plugin.b", auditMeta(t, records[1])[model.PostDeliveryKeyPluginID])
	})

	t.Run("one record per post handed to a plugin", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		posts := []*model.Post{th.CreatePost(t, th.BasicChannel), th.CreatePost(t, th.BasicChannel)}

		th.App.RecordPostsDeliveryToPlugin(th.Context, "com.example.plugin", posts)
		require.Len(t, capture.records(), 2)
	})

	t.Run("webhook delivery has no actor and carries webhook_id", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPostDeliveryToWebhook(th.Context, "hook-id", th.BasicPost)

		actorUserID, meta := capture.requireOne()
		require.Empty(t, actorUserID)
		require.Equal(t, "hook-id", meta[model.PostDeliveryKeyWebhookID])
		require.Equal(t, model.DeliveryMechanismOutgoingWebhook, meta[model.PostDeliveryKeyMechanism])
	})

	t.Run("empty integration ids emit nothing", func(t *testing.T) {
		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPostDeliveryToPlugin(th.Context, "", th.BasicPost)
		th.App.RecordPostDeliveryToWebhook(th.Context, "", th.BasicPost)
		th.App.RecordPostDeliveryToPlugins(th.Context, nil, th.BasicPost)
		capture.requireNone()
	})
}

// TestTriggerWebhookRecordsDeliveryOncePerHook drives the real outgoing webhook path: a hook
// with two callback URLs is one logical integration, so it must produce one record.
func TestTriggerWebhookRecordsDeliveryOncePerHook(t *testing.T) {
	th := setupDeliveryTracking(t)

	received := make(chan struct{}, 2)
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received <- struct{}{}
	})
	ts1 := httptest.NewServer(handler)
	defer ts1.Close()
	ts2 := httptest.NewServer(handler)
	defer ts2.Close()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "localhost,127.0.0.1"
		*cfg.ServiceSettings.EnableOutgoingWebhooks = true
	})

	channel := th.CreateChannel(t, th.BasicTeam)
	post := th.CreatePost(t, channel)

	hook, appErr := th.App.CreateOutgoingWebhook(&model.OutgoingWebhook{
		ChannelId:    channel.Id,
		TeamId:       channel.TeamId,
		CallbackURLs: []string{ts1.URL, ts2.URL},
		CreatorId:    th.BasicUser.Id,
		TriggerWords: []string{"Abracadabra"},
		ContentType:  "application/json",
	})
	require.Nil(t, appErr)

	capture := startDeliveryAuditCapture(t, th)

	th.App.TriggerWebhook(th.Context, &model.OutgoingWebhookPayload{
		Token:       hook.Token,
		TeamId:      hook.TeamId,
		ChannelId:   channel.Id,
		PostId:      post.Id,
		Text:        post.Message,
		TriggerWord: "Abracadabra",
	}, hook, post, channel)

	// TriggerWebhook fans out to both URLs concurrently and waits for them.
	for range 2 {
		select {
		case <-received:
		case <-time.After(10 * time.Second):
			require.Fail(t, "timed out waiting for the webhook callbacks")
		}
	}

	actorUserID, meta := capture.requireOne()
	require.Empty(t, actorUserID)
	require.Equal(t, hook.Id, meta[model.PostDeliveryKeyWebhookID])
	require.Equal(t, post.Id, meta[model.PostDeliveryKeyPostID])
	require.Equal(t, channel.Id, meta[model.PostDeliveryKeyChannelID])
	require.Equal(t, model.DeliveryMechanismOutgoingWebhook, meta[model.PostDeliveryKeyMechanism])
}

func TestRecordPushDelivery(t *testing.T) {
	th := setupDeliveryTracking(t)

	newMsg := func() *model.PushNotification {
		return &model.PushNotification{
			Type:      model.PushTypeMessage,
			PostId:    th.BasicPost.Id,
			ChannelId: th.BasicPost.ChannelId,
			SenderId:  th.BasicPost.UserId,
			PostType:  th.BasicPost.Type,
		}
	}

	t.Run("records a full content message push", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.EmailSettings.PushNotificationContents = model.NewPointer(model.FullNotification)
		})

		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPushDelivery(th.Context, th.BasicUser2.Id, newMsg())

		actorUserID, meta := capture.requireOne()
		require.Equal(t, th.BasicUser2.Id, actorUserID)
		require.Equal(t, model.DeliveryMechanismPush, meta[model.PostDeliveryKeyMechanism])
	})

	t.Run("skips a generic push, which carries no content", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.EmailSettings.PushNotificationContents = model.NewPointer(model.GenericNotification)
		})

		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPushDelivery(th.Context, th.BasicUser2.Id, newMsg())
		capture.requireNone()
	})

	t.Run("skips non-message push types", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.EmailSettings.PushNotificationContents = model.NewPointer(model.FullNotification)
		})

		msg := newMsg()
		msg.Type = model.PushTypeClear

		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPushDelivery(th.Context, th.BasicUser2.Id, msg)
		capture.requireNone()
	})

	t.Run("skips the sender", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.EmailSettings.PushNotificationContents = model.NewPointer(model.FullNotification)
		})

		capture := startDeliveryAuditCapture(t, th)
		th.App.RecordPushDelivery(th.Context, th.BasicPost.UserId, newMsg())
		capture.requireNone()
	})
}
