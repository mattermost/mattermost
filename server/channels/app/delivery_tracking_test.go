// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/audit"
)

// enableDeliveryTracking turns on the PostDeliveryTracking feature flag and the
// admin setting that together gate delivery tracking. The flag is normally
// read-only in tests, so it must be unlocked first.
func enableDeliveryTracking(th *TestHelper) {
	th.Server.platform.SetConfigReadOnlyFF(false)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.PostDeliveryTracking = true
		cfg.DeliveryTrackingSettings.Enable = model.NewPointer(true)
	})
}

// captureDeliveryRecords swaps in a file-backed audit logger that only records
// post-delivery events, runs fn, and returns the Meta map of every record
// emitted. It mirrors how the real user_post_delivery target reads these records.
func captureDeliveryRecords(t *testing.T, th *TestHelper, fn func()) []map[string]any {
	t.Helper()

	filePath := filepath.Join(t.TempDir(), "delivery_audit.log")
	adt := &audit.Audit{}
	adt.Init(audit.DefMaxQueueSize)
	options, err := json.Marshal(map[string]string{"filename": filePath})
	require.NoError(t, err)
	require.NoError(t, adt.Configure(mlog.LoggerConfiguration{
		"delivery_capture": {
			Type:    "file",
			Format:  "json",
			Options: json.RawMessage(options),
			Levels:  []mlog.Level{mlog.LvlAuditPostDelivery},
		},
	}))

	old := th.Server.DeliveryAudit
	th.Server.DeliveryAudit = adt
	// Restore the original delivery audit logger even if fn() aborts via require.FailNow,
	// so a failing assertion doesn't leak the swapped logger into later tests.
	defer func() { th.Server.DeliveryAudit = old }()
	fn()
	require.NoError(t, adt.Shutdown()) // flushes queued records and closes the file

	data, err := os.ReadFile(filePath)
	if os.IsNotExist(err) {
		// The file target only creates the file once it writes a record, so a
		// missing file means nothing was emitted.
		return nil
	}
	require.NoError(t, err)

	var records []map[string]any
	for line := range strings.SplitSeq(strings.TrimSpace(string(data)), "\n") {
		if line == "" {
			continue
		}
		var entry struct {
			Meta map[string]any `json:"meta"`
		}
		require.NoError(t, json.Unmarshal([]byte(line), &entry))
		records = append(records, entry.Meta)
	}
	return records
}

// deliveryStrings reads a JSON-decoded []any (e.g. post_ids/target_ids) as a
// []string for comparison.
func deliveryStrings(t *testing.T, v any) []string {
	t.Helper()
	raw, ok := v.([]any)
	require.True(t, ok, "expected a JSON array, got %T", v)
	out := make([]string, 0, len(raw))
	for _, item := range raw {
		s, ok := item.(string)
		require.True(t, ok, "expected string element, got %T", item)
		out = append(out, s)
	}
	return out
}

// TestConfigureDeliveryAudit exercises the dedicated delivery audit engine's auto-wiring:
// no target when the feature is disabled, and a level-104 target wired from config when
// enabled — without any admin-supplied logr JSON.
func TestConfigureDeliveryAudit(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	t.Run("succeeds with no targets when the feature is disabled", func(t *testing.T) {
		require.NoError(t, th.Server.configurePostDeliveryAudit())
	})

	t.Run("auto-wires the delivery target when the feature is enabled", func(t *testing.T) {
		enableDeliveryTracking(th)
		require.NoError(t, th.Server.configurePostDeliveryAudit())
	})
}

func TestChunkDeliveryIDs(t *testing.T) {
	t.Run("nil/empty input returns nil", func(t *testing.T) {
		require.Nil(t, chunkDeliveryIDs(nil, 100))
		require.Nil(t, chunkDeliveryIDs([]string{}, 100))
	})

	t.Run("all-empty ids return nil", func(t *testing.T) {
		require.Nil(t, chunkDeliveryIDs([]string{"", "", ""}, 100))
	})

	t.Run("single chunk reuses the input backing array (no copy)", func(t *testing.T) {
		ids := []string{"a", "b", "c"}
		chunks := chunkDeliveryIDs(ids, 100)
		require.Len(t, chunks, 1)
		require.Equal(t, ids, chunks[0])
		// Same backing array: mutating the input is visible through the chunk.
		ids[0] = "z"
		require.Equal(t, "z", chunks[0][0])
	})

	t.Run("splits into chunks of at most size", func(t *testing.T) {
		ids := []string{"a", "b", "c", "d", "e"}
		chunks := chunkDeliveryIDs(ids, 2)
		require.Len(t, chunks, 3)
		require.Equal(t, []string{"a", "b"}, chunks[0])
		require.Equal(t, []string{"c", "d"}, chunks[1])
		require.Equal(t, []string{"e"}, chunks[2])
	})

	t.Run("compacts empty ids before chunking", func(t *testing.T) {
		ids := []string{"a", "", "b", "", "c"}
		chunks := chunkDeliveryIDs(ids, 100)
		require.Len(t, chunks, 1)
		require.Equal(t, []string{"a", "b", "c"}, chunks[0])
	})

	t.Run("exact multiple of size", func(t *testing.T) {
		chunks := chunkDeliveryIDs([]string{"a", "b", "c", "d"}, 2)
		require.Len(t, chunks, 2)
		require.Equal(t, []string{"a", "b"}, chunks[0])
		require.Equal(t, []string{"c", "d"}, chunks[1])
	})
}

func TestDeliveryMeta(t *testing.T) {
	t.Run("user target type is omitted (target defaults to user)", func(t *testing.T) {
		meta := deliveryMeta(model.DeliveryTargetUser, model.DeliveryMechanismProduct)
		require.Equal(t, model.DeliveryMechanismProduct, meta["mechanism"])
		_, ok := meta["target_type"]
		require.False(t, ok, "target_type should be omitted for the default user type")
	})

	t.Run("empty target type is omitted", func(t *testing.T) {
		meta := deliveryMeta("", model.DeliveryMechanismPush)
		_, ok := meta["target_type"]
		require.False(t, ok)
	})

	t.Run("non-user target type is written", func(t *testing.T) {
		meta := deliveryMeta(model.DeliveryTargetWebhook, model.DeliveryMechanismOutgoingWebhook)
		require.Equal(t, model.DeliveryTargetWebhook, meta["target_type"])
		require.Equal(t, model.DeliveryMechanismOutgoingWebhook, meta["mechanism"])
	})

	t.Run("mechanism is stored as int16 for the target's type assertion", func(t *testing.T) {
		meta := deliveryMeta(model.DeliveryTargetPlugin, model.DeliveryMechanismPlugin)
		v, ok := meta["mechanism"].(int16)
		require.True(t, ok, "mechanism must be int16 so the audit target can assert it")
		require.Equal(t, model.DeliveryMechanismPlugin, v)
	})
}

func TestShouldTrackDelivery(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	openChannel := &model.Channel{Type: model.ChannelTypeOpen}
	dmChannel := &model.Channel{Type: model.ChannelTypeDirect}
	gmChannel := &model.Channel{Type: model.ChannelTypeGroup}
	normalPost := &model.Post{Type: model.PostTypeDefault}
	systemPost := &model.Post{Type: model.PostTypeJoinChannel}

	enableDeliveryTracking(th)

	t.Run("true for a normal post in a non-DM/GM channel", func(t *testing.T) {
		require.True(t, th.App.shouldTrackDelivery(openChannel, normalPost))
	})

	t.Run("false for a nil channel", func(t *testing.T) {
		require.False(t, th.App.shouldTrackDelivery(nil, normalPost))
	})

	t.Run("false for a nil post", func(t *testing.T) {
		require.False(t, th.App.shouldTrackDelivery(openChannel, nil))
	})

	t.Run("true for a direct message channel", func(t *testing.T) {
		require.True(t, th.App.shouldTrackDelivery(dmChannel, normalPost))
	})

	t.Run("true for a group message channel", func(t *testing.T) {
		require.True(t, th.App.shouldTrackDelivery(gmChannel, normalPost))
	})

	t.Run("false for a system message", func(t *testing.T) {
		require.False(t, th.App.shouldTrackDelivery(openChannel, systemPost))
	})
}

func TestShouldTrackPushDelivery(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	enableDeliveryTracking(th)
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.EmailSettings.PushNotificationContents = model.NewPointer(model.FullNotification)
	})

	fullMsg := func() *model.PushNotification {
		return &model.PushNotification{
			Type:        model.PushTypeMessage,
			PostId:      "post1",
			ChannelType: model.ChannelTypeOpen,
			PostType:    model.PostTypeDefault,
		}
	}

	t.Run("true for a full message push carrying the post body", func(t *testing.T) {
		require.True(t, th.App.shouldTrackPushDelivery(fullMsg()))
	})

	t.Run("false for a non-message push type (e.g. clear)", func(t *testing.T) {
		msg := fullMsg()
		msg.Type = model.PushTypeClear
		require.False(t, th.App.shouldTrackPushDelivery(msg))
	})

	t.Run("false when the push carries no post id", func(t *testing.T) {
		msg := fullMsg()
		msg.PostId = ""
		require.False(t, th.App.shouldTrackPushDelivery(msg))
	})

	t.Run("false when push contents are not full (id_loaded/generic)", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.EmailSettings.PushNotificationContents = model.NewPointer(model.GenericNotification)
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.EmailSettings.PushNotificationContents = model.NewPointer(model.FullNotification)
		})
		require.False(t, th.App.shouldTrackPushDelivery(fullMsg()))
	})

	t.Run("true for a DM/GM channel push", func(t *testing.T) {
		msg := fullMsg()
		msg.ChannelType = model.ChannelTypeDirect
		require.True(t, th.App.shouldTrackPushDelivery(msg))
	})

	t.Run("false for a system message push", func(t *testing.T) {
		msg := fullMsg()
		msg.PostType = model.PostTypeJoinChannel
		require.False(t, th.App.shouldTrackPushDelivery(msg))
	})
}

func TestRecordPostDelivery(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	enableDeliveryTracking(th)

	t.Run("emits a single delivery record", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostDelivery("hook1", "post1", model.DeliveryTargetWebhook, model.DeliveryMechanismOutgoingWebhook)
		})

		require.Len(t, records, 1)
		require.Equal(t, "post1", records[0]["post_id"])
		require.Equal(t, "hook1", records[0]["target_id"])
		require.Equal(t, model.DeliveryTargetWebhook, records[0]["target_type"])
		require.Equal(t, model.DeliveryMechanismOutgoingWebhook, int16(records[0]["mechanism"].(float64)))
	})

	t.Run("user target type is omitted from the record", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostDelivery("user1", "post1", model.DeliveryTargetUser, model.DeliveryMechanismProduct)
		})
		require.Len(t, records, 1)
		_, hasTargetType := records[0]["target_type"]
		require.False(t, hasTargetType)
	})

	t.Run("no record when target id is empty", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostDelivery("", "post1", model.DeliveryTargetUser, model.DeliveryMechanismProduct)
		})
		require.Empty(t, records)
	})

	t.Run("no record when post id is empty", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostDelivery("user1", "", model.DeliveryTargetUser, model.DeliveryMechanismProduct)
		})
		require.Empty(t, records)
	})

	t.Run("no record when delivery tracking is disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.DeliveryTrackingSettings.Enable = model.NewPointer(false) })
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.DeliveryTrackingSettings.Enable = model.NewPointer(true) })
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostDelivery("user1", "post1", model.DeliveryTargetUser, model.DeliveryMechanismProduct)
		})
		require.Empty(t, records)
	})
}

func TestRecordPostDeliveryFanIn(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	enableDeliveryTracking(th)

	t.Run("emits one fan-in record with all post ids", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostDeliveryFanIn("user1", []string{"p1", "p2"}, model.DeliveryTargetUser, model.DeliveryMechanismProduct)
		})
		require.Len(t, records, 1)
		require.Equal(t, "user1", records[0]["target_id"])
		require.ElementsMatch(t, []string{"p1", "p2"}, deliveryStrings(t, records[0]["post_ids"]))
	})

	t.Run("splits into multiple records on the chunk boundary", func(t *testing.T) {
		postIDs := make([]string, deliveryChunkSize+1)
		for i := range postIDs {
			postIDs[i] = fmt.Sprintf("p%d", i)
		}
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostDeliveryFanIn("user1", postIDs, model.DeliveryTargetUser, model.DeliveryMechanismProduct)
		})
		require.Len(t, records, 2)
		require.Len(t, deliveryStrings(t, records[0]["post_ids"]), deliveryChunkSize)
		require.Len(t, deliveryStrings(t, records[1]["post_ids"]), 1)
	})

	t.Run("no record when target id is empty", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostDeliveryFanIn("", []string{"p1"}, model.DeliveryTargetUser, model.DeliveryMechanismProduct)
		})
		require.Empty(t, records)
	})

	t.Run("no record when there are no post ids", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostDeliveryFanIn("user1", nil, model.DeliveryTargetUser, model.DeliveryMechanismProduct)
		})
		require.Empty(t, records)
	})
}

func TestRecordPostDeliveryFanOut(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	enableDeliveryTracking(th)

	t.Run("emits one fan-out record with all target ids", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostDeliveryFanOut("post1", []string{"u1", "u2"}, model.DeliveryTargetUser, model.DeliveryMechanismProduct)
		})
		require.Len(t, records, 1)
		require.Equal(t, "post1", records[0]["post_id"])
		require.ElementsMatch(t, []string{"u1", "u2"}, deliveryStrings(t, records[0]["target_ids"]))
	})

	t.Run("splits into multiple records on the chunk boundary", func(t *testing.T) {
		targetIDs := make([]string, deliveryChunkSize+1)
		for i := range targetIDs {
			targetIDs[i] = fmt.Sprintf("u%d", i)
		}
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostDeliveryFanOut("post1", targetIDs, model.DeliveryTargetPlugin, model.DeliveryMechanismPlugin)
		})
		require.Len(t, records, 2)
		require.Len(t, deliveryStrings(t, records[0]["target_ids"]), deliveryChunkSize)
		require.Len(t, deliveryStrings(t, records[1]["target_ids"]), 1)
	})

	t.Run("no record when post id is empty", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostDeliveryFanOut("", []string{"u1"}, model.DeliveryTargetUser, model.DeliveryMechanismProduct)
		})
		require.Empty(t, records)
	})

	t.Run("no record when there are no target ids", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostDeliveryFanOut("post1", nil, model.DeliveryTargetUser, model.DeliveryMechanismProduct)
		})
		require.Empty(t, records)
	})
}

func TestRecordPostListDeliveryToPlugin(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	enableDeliveryTracking(th)

	makeList := func() *model.PostList {
		return &model.PostList{
			Order: []string{"p1", "p2", "sys"},
			Posts: map[string]*model.Post{
				"p1":  {Id: "p1", Type: model.PostTypeDefault},
				"p2":  {Id: "p2", Type: model.PostTypeDefault},
				"sys": {Id: "sys", Type: model.PostTypeJoinChannel},
			},
		}
	}

	t.Run("emits a fan-in record tagged for the plugin target, skipping system posts", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostListDeliveryToPlugin("plugin.example", makeList())
		})

		require.Len(t, records, 1)
		require.Equal(t, "plugin.example", records[0]["target_id"])
		require.Equal(t, model.DeliveryTargetPlugin, records[0]["target_type"])
		require.Equal(t, model.DeliveryMechanismPlugin, int16(records[0]["mechanism"].(float64)))
		require.ElementsMatch(t, []string{"p1", "p2"}, deliveryStrings(t, records[0]["post_ids"]))
	})

	t.Run("no record when delivery tracking is disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.DeliveryTrackingSettings.Enable = model.NewPointer(false) })
		defer th.App.UpdateConfig(func(cfg *model.Config) { cfg.DeliveryTrackingSettings.Enable = model.NewPointer(true) })

		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostListDeliveryToPlugin("plugin.example", makeList())
		})
		require.Empty(t, records)
	})

	t.Run("no record when the list has only system posts", func(t *testing.T) {
		list := &model.PostList{
			Order: []string{"sys"},
			Posts: map[string]*model.Post{"sys": {Id: "sys", Type: model.PostTypeJoinChannel}},
		}
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostListDeliveryToPlugin("plugin.example", list)
		})
		require.Empty(t, records)
	})

	t.Run("no record when the plugin id is empty", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostListDeliveryToPlugin("", makeList())
		})
		require.Empty(t, records)
	})
}

func TestRecordPostsDeliveryToPlugin(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	enableDeliveryTracking(th)

	t.Run("emits a fan-in record skipping nil, unsaved, and system posts", func(t *testing.T) {
		posts := []*model.Post{
			{Id: "p1", Type: model.PostTypeDefault},
			nil,
			{Id: "", Type: model.PostTypeDefault}, // unsaved, no id
			{Id: "sys", Type: model.PostTypeJoinChannel},
			{Id: "p2", Type: model.PostTypeDefault},
		}

		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostsDeliveryToPlugin("plugin.example", posts)
		})

		require.Len(t, records, 1)
		require.Equal(t, "plugin.example", records[0]["target_id"])
		require.Equal(t, model.DeliveryTargetPlugin, records[0]["target_type"])
		require.Equal(t, model.DeliveryMechanismPlugin, int16(records[0]["mechanism"].(float64)))
		require.ElementsMatch(t, []string{"p1", "p2"}, deliveryStrings(t, records[0]["post_ids"]))
	})

	t.Run("no record when every post is filtered out", func(t *testing.T) {
		posts := []*model.Post{nil, {Id: ""}, {Id: "sys", Type: model.PostTypeJoinChannel}}
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostsDeliveryToPlugin("plugin.example", posts)
		})
		require.Empty(t, records)
	})
}

// TestRecordPostListDeliveryTargetTypes guards that the user-facing wrapper still
// records the default user target (target_type omitted) after the helpers were
// parameterized to support the plugin target, while the plugin wrapper tags its
// records explicitly.
func TestRecordPostListDeliveryTargetTypes(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	enableDeliveryTracking(th)

	list := &model.PostList{
		Order: []string{"p1"},
		Posts: map[string]*model.Post{"p1": {Id: "p1", Type: model.PostTypeDefault}},
	}

	t.Run("user wrapper omits target_type and keeps the given mechanism", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostListDelivery("user1", list, model.DeliveryMechanismProduct)
		})

		require.Len(t, records, 1)
		require.Equal(t, "user1", records[0]["target_id"])
		_, hasTargetType := records[0]["target_type"]
		require.False(t, hasTargetType, "user target_type should be omitted")
		require.Equal(t, model.DeliveryMechanismProduct, int16(records[0]["mechanism"].(float64)))
	})

	t.Run("plugin wrapper tags the plugin target type", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			th.App.RecordPostListDeliveryToPlugin("plugin.example", list)
		})

		require.Len(t, records, 1)
		require.Equal(t, model.DeliveryTargetPlugin, records[0]["target_type"])
	})
}

// TestPluginAPIRecordsPluginDelivery covers the plugin_api.go wiring that records
// a delivery to the calling plugin whenever it reads post content.
func TestPluginAPIRecordsPluginDelivery(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	enableDeliveryTracking(th)

	api := th.SetupPluginAPI() // manifest id is "pluginid"
	post := th.CreatePost(t, th.BasicChannel)

	t.Run("GetPost records a single plugin delivery", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			_, appErr := api.GetPost(post.Id)
			require.Nil(t, appErr)
		})

		require.Len(t, records, 1)
		require.Equal(t, post.Id, records[0]["post_id"])
		require.Equal(t, "pluginid", records[0]["target_id"])
		require.Equal(t, model.DeliveryTargetPlugin, records[0]["target_type"])
		require.Equal(t, model.DeliveryMechanismPlugin, int16(records[0]["mechanism"].(float64)))
	})

	t.Run("GetPostsForChannel records a fan-in plugin delivery", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			_, appErr := api.GetPostsForChannel(th.BasicChannel.Id, 0, 60)
			require.Nil(t, appErr)
		})

		require.Len(t, records, 1)
		require.Equal(t, "pluginid", records[0]["target_id"])
		require.Equal(t, model.DeliveryTargetPlugin, records[0]["target_type"])
		require.Contains(t, deliveryStrings(t, records[0]["post_ids"]), post.Id)
	})

	t.Run("GetPostThread records a fan-in plugin delivery", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			_, appErr := api.GetPostThread(post.Id)
			require.Nil(t, appErr)
		})

		require.Len(t, records, 1)
		require.Equal(t, "pluginid", records[0]["target_id"])
		require.Equal(t, model.DeliveryTargetPlugin, records[0]["target_type"])
		require.Contains(t, deliveryStrings(t, records[0]["post_ids"]), post.Id)
	})

	t.Run("GetPostsSince records a fan-in plugin delivery", func(t *testing.T) {
		records := captureDeliveryRecords(t, th, func() {
			_, appErr := api.GetPostsSince(th.BasicChannel.Id, 1)
			require.Nil(t, appErr)
		})

		require.Len(t, records, 1)
		require.Equal(t, "pluginid", records[0]["target_id"])
		require.Equal(t, model.DeliveryTargetPlugin, records[0]["target_type"])
		require.Contains(t, deliveryStrings(t, records[0]["post_ids"]), post.Id)
	})

	t.Run("GetPostsAfter records a fan-in plugin delivery", func(t *testing.T) {
		// A post after the anchor so the list is non-empty.
		later := th.CreatePost(t, th.BasicChannel)
		records := captureDeliveryRecords(t, th, func() {
			_, appErr := api.GetPostsAfter(th.BasicChannel.Id, post.Id, 0, 60)
			require.Nil(t, appErr)
		})

		require.Len(t, records, 1)
		require.Equal(t, "pluginid", records[0]["target_id"])
		require.Equal(t, model.DeliveryTargetPlugin, records[0]["target_type"])
		require.Contains(t, deliveryStrings(t, records[0]["post_ids"]), later.Id)
	})

	t.Run("GetPostsBefore records a fan-in plugin delivery", func(t *testing.T) {
		anchor := th.CreatePost(t, th.BasicChannel)
		records := captureDeliveryRecords(t, th, func() {
			_, appErr := api.GetPostsBefore(th.BasicChannel.Id, anchor.Id, 0, 60)
			require.Nil(t, appErr)
		})

		require.Len(t, records, 1)
		require.Equal(t, "pluginid", records[0]["target_id"])
		require.Equal(t, model.DeliveryTargetPlugin, records[0]["target_type"])
		require.Contains(t, deliveryStrings(t, records[0]["post_ids"]), post.Id)
	})
}

// pluginDeliveryRecords keeps only the records tagged for the plugin target;
// creating a post also emits user/product delivery records that race in on
// other goroutines, and those are not what these tests assert on.
func pluginDeliveryRecords(records []map[string]any) []map[string]any {
	var out []map[string]any
	for _, r := range records {
		if r["target_type"] == model.DeliveryTargetPlugin {
			out = append(out, r)
		}
	}
	return out
}

// TestCreatePostRecordsPluginDelivery exercises the guarded_hooks.go +
// post.go path end to end: a plugin that receives the post via
// MessageWillBePosted is recorded as a delivery target once the post is saved
// (the hook runs before the post has an id, so recording is deferred).
func TestCreatePostRecordsPluginDelivery(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	enableDeliveryTracking(th)

	tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{
		`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			return nil, ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
	}, th.App, th.NewPluginAPI)
	defer tearDown()
	require.Len(t, pluginIDs, 1)

	var created *model.Post
	records := captureDeliveryRecords(t, th, func() {
		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "hello plugin delivery",
		}
		var appErr *model.AppError
		created, _, appErr = th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)
	})

	pluginRecords := pluginDeliveryRecords(records)
	require.Len(t, pluginRecords, 1)
	require.Equal(t, created.Id, pluginRecords[0]["post_id"])
	require.Equal(t, model.DeliveryMechanismPlugin, int16(pluginRecords[0]["mechanism"].(float64)))
	require.Contains(t, deliveryStrings(t, pluginRecords[0]["target_ids"]), pluginIDs[0])
}

func TestDeliveryTrackingEnabledForChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	enableDeliveryTracking(th)

	t.Run("true for any channel in all-channels mode (default)", func(t *testing.T) {
		require.True(t, th.App.deliveryTrackingEnabledForChannel("channel1"))
		require.True(t, th.App.deliveryTrackingEnabledForChannel(""))
	})

	t.Run("selected-channels mode tracks only the channels in the snapshot", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.DeliveryTrackingSettings.EnableForAllChannels = model.NewPointer(false)
		})
		defer th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.DeliveryTrackingSettings.EnableForAllChannels = model.NewPointer(true)
		})

		tracked := map[string]struct{}{"channel1": {}}
		th.App.Channels().deliveryTrackedChannels.Store(&tracked)

		require.True(t, th.App.deliveryTrackingEnabledForChannel("channel1"))
		require.False(t, th.App.deliveryTrackingEnabledForChannel("channel2"))
		require.False(t, th.App.deliveryTrackingEnabledForChannel(""))
	})
}

// TestRecordPostsDeliverySelectedChannels verifies the multi-channel list helper
// filters out posts whose channel is not in the selected-channel snapshot.
func TestRecordPostsDeliverySelectedChannels(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)
	enableDeliveryTracking(th)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.DeliveryTrackingSettings.EnableForAllChannels = model.NewPointer(false)
	})
	tracked := map[string]struct{}{"trackedchannel": {}}
	th.App.Channels().deliveryTrackedChannels.Store(&tracked)

	posts := []*model.Post{
		{Id: "p1", ChannelId: "trackedchannel", Type: model.PostTypeDefault},
		{Id: "p2", ChannelId: "untrackedchannel", Type: model.PostTypeDefault},
	}

	records := captureDeliveryRecords(t, th, func() {
		th.App.RecordPostsDelivery("user1", posts, model.DeliveryMechanismProduct)
	})

	require.Len(t, records, 1)
	require.ElementsMatch(t, []string{"p1"}, deliveryStrings(t, records[0]["post_ids"]))
}
