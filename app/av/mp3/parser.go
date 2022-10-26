// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mp3

import (
	"bufio"
	"fmt"
	"io"
	"math"
)

const (
	headerSize  = 4         // 32 bits (4 bytes) header size
	frameLength = 1152      // number of samples in single MP3 frame
	bufSize     = 64 * 1024 // 64KB
)

var bitrateMap = map[int]int{
	0: 0, 1: 32, 2: 40, 3: 48, 4: 56, 5: 64, 6: 80,
	7: 96, 8: 112, 9: 128, 10: 160, 11: 192, 12: 224,
	13: 256, 14: 320, 15: -1,
}

var rateMap = map[int]int{
	0: 44100,
	1: 48000,
	2: 32000,
	3: -1,
}

type Parser func(rd io.ReadSeeker) (ParseInfo, error)
type ParseInfo struct {
	SampleRate int
	Duration   float64
	Channels   int
}

type Header struct {
	version     int
	layer       int
	bitrate     int
	sampleRate  int
	channelMode int
	frameLength int
	protected   bool
}

func parseHeader(data []byte) (Header, bool) {
	var hdr Header
	if len(data) < headerSize {
		return hdr, false
	}

	sync := data[0]&0xff == 0xff && data[1]&0xe0 == 0xe0
	if !sync {
		return hdr, false
	}

	version := (data[1] & 0x18) >> 3
	if version != 0x3 {
		return hdr, false
	}

	layer := (data[1] & 0x6) >> 1
	if layer != 0x1 {
		return hdr, false
	}

	protected := data[1]&0x1 == 0x0

	bitrateIdx := int(data[2] >> 4)

	bitrate := bitrateMap[bitrateIdx]
	if bitrate < 0 {
		return hdr, false
	}

	rateIdx := int((data[2] & 0xc) >> 2)
	rate := rateMap[rateIdx]
	if rate <= 0 {
		return hdr, false
	}

	padding := int((data[2] & 0x2) >> 1)

	channelMode := data[3] >> 6

	hdr.version = int(version)
	hdr.layer = int(layer)
	hdr.bitrate = bitrate
	hdr.sampleRate = rate
	hdr.channelMode = int(channelMode)
	hdr.protected = protected

	hdr.frameLength = ((144 * hdr.bitrate * 1000) / (hdr.sampleRate)) + padding
	if hdr.frameLength == 0 {
		return hdr, false
	}

	return hdr, true
}

func Parse(rd io.ReadSeeker) (ParseInfo, error) {
	var info ParseInfo

	bufRd := bufio.NewReaderSize(rd, bufSize)
	frames := 0

	for {
		hdrData, err := bufRd.Peek(headerSize)
		if err == io.EOF {
			break
		} else if err != nil {
			return ParseInfo{}, fmt.Errorf("failed to peek: %w", err)
		}

		discardLen := 1
		if hdr, ok := parseHeader(hdrData); ok {
			if frames == 0 {
				info.SampleRate = hdr.sampleRate
				if hdr.channelMode == 3 {
					info.Channels = 1
				} else {
					info.Channels = 2
				}
			}
			frames++
			discardLen = hdr.frameLength
		} else if frames > 0 {
			return ParseInfo{}, fmt.Errorf("failed to parse next frame")
		}

		_, err = bufRd.Discard(discardLen)
		if err != nil {
			return ParseInfo{}, fmt.Errorf("failed to discard: %w", err)
		}
	}

	if info.SampleRate == 0 {
		return ParseInfo{}, fmt.Errorf("missing samplerate")
	}

	duration := float64(frames*frameLength) / float64(info.SampleRate)
	info.Duration = math.Round(duration*1000) / 1000

	return info, nil
}
