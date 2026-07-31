// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

// gzip-6 (production default) vs go-brrr-2 (brotliCompressionLevel, handlers.go):
//
//	fixture                                    time/mem/ratio (gzip-6)     time/mem/ratio (go-brrr-2)
//	tiny_ping_like_5_fields                      13.2us /  795KB / 1.34x     3.5us /  17KB / 1.40x
//	small_single_resource_50_fields              34.7us /  799KB / 2.08x    12.5us /  22KB / 2.04x
//	medium_post_list_page_800_fields            537.0us /  859KB / 2.23x   148.9us / 920KB / 2.36x
//	large_realistic_1078_channels                 2.44ms /  1.0MB / 8.23x  815.2us / 2.0MB / 10.49x
//	xlarge_old_hardcoded_limit_10000_channels    21.84ms /  2.9MB / 8.33x   8.19ms / 4.8MB / 8.96x
//	adversarial_50000_channels                  122.97ms / 16.8MB / 8.37x  45.16ms / 12.0MB / 8.96x
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
	for i := 0; i < fieldCount; i++ {
		m[fmt.Sprintf("field_%d", i)] = fmt.Sprintf("value_%d_%s", i, model.NewId())
	}
	body, err := json.Marshal(m)
	if err != nil {
		panic(err)
	}
	return body
}

// buildExperienceInitialLoadFixture uses the real ExperienceChannel/ExperienceChannelMember
// DTOs so the benchmark reflects actual field density.
func buildExperienceInitialLoadFixture(channelCount int) []byte {
	channels := make([]*model.ExperienceChannel, 0, channelCount)
	members := make([]*model.ExperienceChannelMember, 0, channelCount)
	for i := 0; i < channelCount; i++ {
		id := model.NewId()
		channels = append(channels, &model.ExperienceChannel{
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
		members = append(members, &model.ExperienceChannelMember{
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
		Channels []*model.ExperienceChannel       `json:"channels"`
		Members  []*model.ExperienceChannelMember `json:"channel_members"`
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
		{"large_realistic_1078_channels", buildExperienceInitialLoadFixture(1078)},
		{"xlarge_old_hardcoded_limit_10000_channels", buildExperienceInitialLoadFixture(10000)},
		{"adversarial_50000_channels", buildExperienceInitialLoadFixture(50000)},
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
// shipped level (brotliCompressionLevel, handlers.go). Run with:
//
//	go test ./channels/api4/... -bench BenchmarkCompression -benchmem -run '^$'
func BenchmarkCompression(b *testing.B) {
	for _, fx := range allCompressionFixtures() {
		b.Run(fx.name, func(b *testing.B) {
			b.Run("gzip", func(b *testing.B) {
				var compressedSize int
				b.ReportAllocs()
				for i := 0; i < b.N; i++ {
					compressedSize = compressGzip(gzip.DefaultCompression, fx.body)
				}
				b.ReportMetric(float64(len(fx.body))/float64(compressedSize), "ratio")
			})
			b.Run("go_brrr", func(b *testing.B) {
				var compressedSize int
				b.ReportAllocs()
				for i := 0; i < b.N; i++ {
					compressedSize = compressGoBrrr(brotliCompressionLevel, fx.body)
				}
				b.ReportMetric(float64(len(fx.body))/float64(compressedSize), "ratio")
			})
		})
	}
}

func TestGoBrrrRoundTripCorrectness(t *testing.T) {
	body := buildExperienceInitialLoadFixture(1078)

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
