// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mp3

import (
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParse(t *testing.T) {
	tcs := []struct {
		name     string
		filename string
		info     ParseInfo
		err      string
	}{
		{
			name:     "44100 stereo 128kbps",
			filename: "./samples/sample-44100-128.mp3",
			info: ParseInfo{
				SampleRate: 44100,
				Duration:   3.265,
				Channels:   2,
			},
			err: "",
		},
		{
			name:     "32000 stereo 96kbps",
			filename: "./samples/sample-32000-96.mp3",
			info: ParseInfo{
				SampleRate: 32000,
				Duration:   3.276,
				Channels:   2,
			},
			err: "",
		},
		{
			name:     "48000 mono 64kbps",
			filename: "./samples/sample-48000-64.mp3",
			info: ParseInfo{
				SampleRate: 48000,
				Duration:   10.224,
				Channels:   1,
			},
			err: "",
		},
		{
			name:     "invalid format",
			filename: "./samples/sample-invalid.mp3",
			info:     ParseInfo{},
			err:      "failed to parse next frame",
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			file, err := os.Open(tc.filename)
			require.NoError(t, err)
			defer file.Close()

			info, err := Parse(file)
			if tc.err == "" {
				require.NoError(t, err)
				require.Equal(t, tc.info, info)
			} else {
				require.EqualError(t, err, tc.err)
				require.Empty(t, info)
			}
		})
	}
}

func TestParseHeader(t *testing.T) {
	tcs := []struct {
		name string
		data []byte
		hdr  Header
		ok   bool
	}{
		{
			name: "empty data",
			data: []byte{},
			hdr:  Header{},
			ok:   false,
		},
		{
			name: "missing sync bits",
			data: []byte{0x45, 0x45, 0x45, 0x45},
			hdr:  Header{},
			ok:   false,
		},
		{
			name: "invalid version",
			data: []byte{0xff, 0xeb, 0x50, 0x00},
			hdr:  Header{},
			ok:   false,
		},
		{
			name: "invalid layer",
			data: []byte{0xff, 0xff, 0x50, 0x00},
			hdr:  Header{},
			ok:   false,
		},
		{
			name: "invalid bitrate",
			data: []byte{0xff, 0xfb, 0xf0, 0x00},
			hdr:  Header{},
			ok:   false,
		},
		{
			name: "44100 64kbps",
			data: []byte{0xff, 0xfb, 0x50, 0x00},
			hdr: Header{
				version:     3,
				layer:       1,
				sampleRate:  44100,
				bitrate:     64,
				frameLength: 208,
			},
			ok: true,
		},
		{
			name: "48000 64kbps",
			data: []byte{0xff, 0xfb, 0x54, 0xc4},
			hdr: Header{
				version:     3,
				layer:       1,
				sampleRate:  48000,
				bitrate:     64,
				frameLength: 192,
				channelMode: 3,
			},
			ok: true,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			hdr, ok := parseHeader(tc.data)
			require.Equal(t, tc.ok, ok)
			require.Equal(t, tc.hdr, hdr)
		})
	}
}

func BenchmarkParse(b *testing.B) {
	file, err := os.Open("./samples/sample-48000-64.mp3")
	require.NoError(b, err)
	defer file.Close()

	b.StopTimer()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		b.StartTimer()
		info, err := Parse(file)
		b.StopTimer()
		require.NoError(b, err)
		require.NotEmpty(b, info)
		file.Seek(0, 0)
	}
}
