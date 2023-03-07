// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"fmt"
	"os"
	"runtime"
	"sync"
	"testing"

	"github.com/mattermost/mattermost-server/server/v7/channels/utils/fileutils"

	"github.com/stretchr/testify/require"
)

func BenchmarkDecoderDecode(b *testing.B) {
	n := runtime.NumCPU()
	for k := 1; k <= n; k++ {
		b.Run(fmt.Sprintf("%d concurrency", k), func(b *testing.B) {
			d, err := NewDecoder(DecoderOptions{
				ConcurrencyLevel: k,
			})
			require.NotNil(b, d)
			require.NoError(b, err)

			imgDir, ok := fileutils.FindDir("tests")
			require.True(b, ok)

			b.ResetTimer()

			var wg sync.WaitGroup
			for i := 0; i < b.N; i++ {
				b.StopTimer()
				wg.Add(1)
				imgFile, err := os.Open(imgDir + "/fill_test_opaque.png")
				require.NoError(b, err)
				defer imgFile.Close()
				b.StartTimer()
				go func() {
					defer wg.Done()
					img, _, err := d.Decode(imgFile)
					require.NoError(b, err)
					require.NotNil(b, img)
				}()
			}

			wg.Wait()
		})
	}
}

func BenchmarkDecoderDecodeMemBounded(b *testing.B) {
	n := runtime.NumCPU()
	for k := 1; k <= n; k++ {
		b.Run(fmt.Sprintf("%d concurrency", k), func(b *testing.B) {
			d, err := NewDecoder(DecoderOptions{
				ConcurrencyLevel: k,
			})
			require.NotNil(b, d)
			require.NoError(b, err)

			imgDir, ok := fileutils.FindDir("tests")
			require.True(b, ok)

			b.ResetTimer()

			var wg sync.WaitGroup
			for i := 0; i < b.N; i++ {
				b.StopTimer()
				wg.Add(1)
				imgFile, err := os.Open(imgDir + "/fill_test_opaque.png")
				require.NoError(b, err)
				defer imgFile.Close()
				b.StartTimer()
				go func() {
					defer wg.Done()
					img, _, release, err := d.DecodeMemBounded(imgFile)
					require.NoError(b, err)
					require.NotNil(b, img)
					release()
				}()
			}

			wg.Wait()
		})
	}
}
