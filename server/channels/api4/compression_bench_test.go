// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

// gzip-6 (production default) vs go-brrr-2 (brotliCompressionLevel, brotli.go):
//
//	fixture                                    time/mem/ratio (gzip-6)      time/mem/ratio (go-brrr-2)
//	tiny_ping_like_5_fields                      22.7us /  814KB / 1.34x      1.6us /   361B / 1.37x
//	small_single_resource_50_fields              36.0us /  818KB / 2.06x      9.4us /  1.5KB / 2.05x
//	medium_post_list_page_800_fields            576.3us /  879KB / 2.23x    118.0us /   45KB / 2.36x
//	large_realistic_1078_channels                 2.55ms /  1.1MB / 8.24x   782.5us /  185KB / 10.49x
//	xlarge_old_hardcoded_limit_10000_channels    23.52ms /  2.9MB / 8.33x    8.32ms /  3.2MB / 8.96x
//	adversarial_50000_channels                  134.11ms / 17.6MB / 8.37x   46.66ms / 12.9MB / 8.96x
//
// Level 2 was picked over 1-11: it's faster and smaller than gzip-6 at every size
// above, and levels 3+ buy at most a marginal ratio gain for a steep memory jump.
import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"testing"

	brrr "github.com/molecule-man/go-brrr"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// buildFlatMapFixture mimics a small, flat JSON response like GET /system/ping.
func buildFlatMapFixture(fieldCount int) []byte {
	m := make(map[string]string, fieldCount)
	for i := range fieldCount {
		m[fmt.Sprintf("field_%d", i)] = fmt.Sprintf("value_%d_%s", i, model.NewId())
	}
	body, err := json.Marshal(m)
	if err != nil {
		panic(err)
	}
	return body
}

// Mirrors the aggregate API's DTOs so the fixture keeps the same serialized
// size without this package depending on them.
type benchChannel struct {
	Id                string            `json:"id"`
	CreateAt          int64             `json:"create_at,omitempty"`
	UpdateAt          int64             `json:"update_at,omitempty"`
	DeleteAt          int64             `json:"delete_at,omitempty"`
	TeamId            string            `json:"team_id"`
	Type              model.ChannelType `json:"type"`
	DisplayName       string            `json:"display_name"`
	Name              string            `json:"name"`
	LastPostAt        int64             `json:"last_post_at"`
	TotalMsgCount     int64             `json:"total_msg_count"`
	CreatorId         string            `json:"creator_id,omitempty"`
	GroupConstrained  *bool             `json:"group_constrained"`
	Shared            *bool             `json:"shared"`
	TotalMsgCountRoot int64             `json:"total_msg_count_root,omitempty"`
	LastRootPostAt    int64             `json:"last_root_post_at,omitempty"`
	PolicyEnforced    bool              `json:"policy_enforced,omitempty"`
	MemberCount       int64             `json:"member_count,omitempty"`
}

type benchChannelMember struct {
	ChannelId               string          `json:"channel_id"`
	UserId                  string          `json:"user_id"`
	Roles                   string          `json:"roles"`
	LastViewedAt            int64           `json:"last_viewed_at"`
	NotifyProps             model.StringMap `json:"notify_props"`
	MsgCount                int64           `json:"msg_count"`
	MentionCount            int64           `json:"mention_count"`
	MentionCountRoot        int64           `json:"mention_count_root"`
	UrgentMentionCount      int64           `json:"urgent_mention_count"`
	MsgCountRoot            int64           `json:"msg_count_root"`
	LastUpdateAt            int64           `json:"last_update_at"`
	SchemeGuest             bool            `json:"scheme_guest"`
	SchemeUser              bool            `json:"scheme_user"`
	SchemeAdmin             bool            `json:"scheme_admin"`
	AutoTranslationDisabled bool            `json:"autotranslation_disabled,omitempty"`
}

func buildAggregateChannelsFixture(channelCount int) []byte {
	channels := make([]*benchChannel, 0, channelCount)
	members := make([]*benchChannelMember, 0, channelCount)
	for i := range channelCount {
		id := model.NewId()
		channels = append(channels, &benchChannel{
			Id:                id,
			CreateAt:          1700000000000,
			UpdateAt:          1700000000000 + int64(i),
			TeamId:            model.NewId(),
			Type:              model.ChannelTypeOpen,
			DisplayName:       fmt.Sprintf("channel-display-name-%d", i),
			Name:              fmt.Sprintf("channel-name-%d", i),
			LastPostAt:        1700000000000,
			TotalMsgCount:     int64(i % 5000),
			TotalMsgCountRoot: int64(i % 5000),
		})
		members = append(members, &benchChannelMember{
			ChannelId: id,
			UserId:    model.NewId(),
			Roles:     "channel_user",
			NotifyProps: model.StringMap{
				"desktop":                 "default",
				"mark_unread":             "all",
				"push":                    "default",
				"email":                   "default",
				"ignore_channel_mentions": "default",
			},
			LastViewedAt:     1700000000000,
			MsgCount:         int64(i % 5000),
			MentionCount:     int64(i % 5),
			MentionCountRoot: int64(i % 5),
			LastUpdateAt:     1700000000000,
			SchemeUser:       true,
		})
	}

	payload := struct {
		Channels []*benchChannel       `json:"channels"`
		Members  []*benchChannelMember `json:"channel_members"`
	}{Channels: channels, Members: members}

	body, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}
	return body
}

type compressionFixture struct {
	name string
	body []byte
}

func allCompressionFixtures() []compressionFixture {
	return []compressionFixture{
		{"tiny_ping_like_5_fields", buildFlatMapFixture(5)},
		{"small_single_resource_50_fields", buildFlatMapFixture(50)},
		{"medium_post_list_page_800_fields", buildFlatMapFixture(800)},
		{"large_realistic_1078_channels", buildAggregateChannelsFixture(1078)},
		{"xlarge_old_hardcoded_limit_10000_channels", buildAggregateChannelsFixture(10000)},
		{"adversarial_50000_channels", buildAggregateChannelsFixture(50000)},
	}
}

func compressGzip(level int, body []byte) int {
	var out bytes.Buffer
	gw, _ := gzip.NewWriterLevel(&out, level)
	_, _ = gw.Write(body)
	_ = gw.Close()
	return out.Len()
}

func compressGoBrrr(level int, body []byte) int {
	var out bytes.Buffer
	w, err := brrr.NewWriter(&out, level)
	if err != nil {
		panic(err)
	}
	_, _ = w.Write(body)
	_ = w.Close()
	return out.Len()
}

// BenchmarkCompression compares gzip's production default against go-brrr at the
// shipped level (brotliCompressionLevel, brotli.go). Run with:
//
//	go test ./channels/api4/... -bench BenchmarkCompression -benchmem -run '^$'
func BenchmarkCompression(b *testing.B) {
	for _, fx := range allCompressionFixtures() {
		b.Run(fx.name, func(b *testing.B) {
			b.Run("gzip", func(b *testing.B) {
				var compressedSize int
				b.ReportAllocs()
				for range b.N {
					compressedSize = compressGzip(gzip.DefaultCompression, fx.body)
				}
				b.ReportMetric(float64(len(fx.body))/float64(compressedSize), "ratio")
			})
			b.Run("go_brrr", func(b *testing.B) {
				var compressedSize int
				b.ReportAllocs()
				for range b.N {
					compressedSize = compressGoBrrr(brotliCompressionLevel, fx.body)
				}
				b.ReportMetric(float64(len(fx.body))/float64(compressedSize), "ratio")
			})
		})
	}
}

func TestGoBrrrRoundTripCorrectness(t *testing.T) {
	body := buildAggregateChannelsFixture(1078)

	var out bytes.Buffer
	w, err := brrr.NewWriter(&out, brotliCompressionLevel)
	require.NoError(t, err)
	_, err = w.Write(body)
	require.NoError(t, err)
	require.NoError(t, w.Close())

	decompressed, err := brrr.Decompress(out.Bytes())
	require.NoError(t, err, "go-brrr output failed to decompress")
	require.True(t, bytes.Equal(decompressed, body), "go-brrr round-trip did not reproduce the original payload")
}
