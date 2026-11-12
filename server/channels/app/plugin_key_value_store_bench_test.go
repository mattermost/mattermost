// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// BenchmarkListPluginKeysWithPrefix compares two ways to collect every key
// with a given prefix:
//   - KVList: page through all keys and filter them in Go.
//   - KVListWithOptions: let the database filter on the prefix.
//
// One key in 100 matches the prefix. The other keys sort before and after the
// matching keys. Run with:
//
//	go test ./channels/app/ -run '^$' -bench BenchmarkListPluginKeysWithPrefix -benchtime 3x -timeout 30m
func BenchmarkListPluginKeysWithPrefix(b *testing.B) {
	th := Setup(b)

	const (
		perPage = 1000
		prefix  = "match_"
	)

	for _, total := range []int{10_000, 100_000, 1_000_000} {
		b.Run(fmt.Sprintf("keys=%d", total), func(b *testing.B) {
			pluginID := model.NewId()
			// The raw DB skips the store query timeout, which the 1M row insert can exceed.
			db := th.GetSqlStore().GetMaster().DB()

			b.Cleanup(func() {
				_, err := db.Exec(`DELETE FROM PluginKeyValueStore WHERE PluginId = $1`, pluginID)
				require.NoError(b, err)
			})
			_, err := db.Exec(`
				INSERT INTO PluginKeyValueStore (PluginId, PKey, PValue, ExpireAt)
				SELECT $1, CASE WHEN i % 100 = 0 THEN $3 WHEN i % 2 = 0 THEN 'a_' ELSE 'z_' END || lpad(i::text, 7, '0'), 'v'::bytea, 0
				FROM generate_series(1, $2::int) AS i`, pluginID, total, prefix)
			require.NoError(b, err)
			_, err = db.Exec(`VACUUM ANALYZE PluginKeyValueStore`)
			require.NoError(b, err)

			want := total / 100

			b.Run("KVList", func(b *testing.B) {
				for b.Loop() {
					var matched []string
					for page := 0; ; page++ {
						keys, appErr := th.App.ListPluginKeys(pluginID, page, perPage)
						require.Nil(b, appErr)
						for _, key := range keys {
							if strings.HasPrefix(key, prefix) {
								matched = append(matched, key)
							}
						}
						if len(keys) < perPage {
							break
						}
					}
					require.Len(b, matched, want)
				}
			})

			b.Run("KVListWithOptions", func(b *testing.B) {
				for b.Loop() {
					var matched []string
					for page := 0; ; page++ {
						keys, appErr := th.App.ListPluginKeysWithOptions(pluginID, model.PluginKVListOptions{Prefix: prefix}, page, perPage)
						require.Nil(b, appErr)
						matched = append(matched, keys...)
						if len(keys) < perPage {
							break
						}
					}
					require.Len(b, matched, want)
				}
			})
		})
	}
}
