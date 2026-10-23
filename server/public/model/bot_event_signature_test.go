// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	botEventTestSecret1 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789AB"
	botEventTestTS      = int64(1761157200)
	botEventTestBody    = `{"event_id":"8xk3w1d9ejgxbqk7c4z5n6m2po","type":"post_dm"}`
)

var botEventTestSecret2 = strings.Repeat("0", 64)

func TestSignBotEventPayload(t *testing.T) {
	tests := []struct {
		name   string
		secret string
		ts     int64
		body   string
		want   string
	}{
		{"V1", botEventTestSecret1, botEventTestTS, botEventTestBody, "v1=9531d855f57ebe141811ee39f8d863fe777f8bed5e24b06f59b320dd522989a9"},
		{"V2 empty body", botEventTestSecret1, botEventTestTS, "", "v1=1b3a41fd27a3c47d27865cd29f727dd2b16a71a2ead150b72518d17db6c2c937"},
		{"V3 url verification", botEventTestSecret1, botEventTestTS, `{"type":"url_verification","challenge":"3q2+7w=="}`, "v1=9275cb0cd2f8c5371df93fbdf1dedc71ee01d5534dc75462762faab49a8b9dec"},
		{"V4 other timestamp", botEventTestSecret1, botEventTestTS + 1, botEventTestBody, "v1=9e6c2662bcdbba9859d7482924183f8e917d3bf845b0f41515b173900282ab75"},
		{"V5 utf-8 body", botEventTestSecret1, botEventTestTS, `{"message":"héllo 👋"}`, "v1=2f387d86a707a5e37a588c80b46d22354e8513558fa90ab61d3e27424c97e888"},
		{"V6 other secret", botEventTestSecret2, botEventTestTS, botEventTestBody, "v1=c2c508ddcc8216276a2b2e4a5fc2edd2751d5dcd976b57116c730127f295f787"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, SignBotEventPayload(tc.secret, tc.ts, []byte(tc.body)))
		})
	}
}

func TestVerifyBotEventSignature(t *testing.T) {
	const v1 = "9531d855f57ebe141811ee39f8d863fe777f8bed5e24b06f59b320dd522989a9"
	const v4 = "9e6c2662bcdbba9859d7482924183f8e917d3bf845b0f41515b173900282ab75"
	ts := "1761157200"
	now := time.Unix(botEventTestTS, 0)
	body := []byte(botEventTestBody)

	tests := []struct {
		name   string
		secret string
		ts     string
		body   []byte
		header string
		now    time.Time
		want   error
	}{
		{"valid", botEventTestSecret1, ts, body, "v1=" + v1, now, nil},
		{"uppercase hex", botEventTestSecret1, ts, body, "v1=" + strings.ToUpper(v1), now, nil},
		{"second of several signatures", botEventTestSecret1, ts, body, "v1=zz, v1=" + v1, now, nil},
		{"unknown scheme", botEventTestSecret1, ts, body, "v0=" + v1, now, ErrBotEventSignatureMissing},
		{"empty header", botEventTestSecret1, ts, body, "", now, ErrBotEventSignatureMissing},
		{"wrong secret", botEventTestSecret2, ts, body, "v1=" + v1, now, ErrBotEventSignatureMismatch},
		{"changed body", botEventTestSecret1, ts, []byte(strings.Replace(botEventTestBody, "post_dm", "post_dn", 1)), "v1=" + v1, now, ErrBotEventSignatureMismatch},
		{"signature for another timestamp", botEventTestSecret1, ts, body, "v1=" + v4, now, ErrBotEventSignatureMismatch},
		{"malformed hex only", botEventTestSecret1, ts, body, "v1=zz", now, ErrBotEventSignatureMismatch},
		{"tolerance edge", botEventTestSecret1, ts, body, "v1=" + v1, now.Add(300 * time.Second), nil},
		{"too old", botEventTestSecret1, ts, body, "v1=" + v1, now.Add(301 * time.Second), ErrBotEventTimestampOutOfRange},
		{"too new", botEventTestSecret1, ts, body, "v1=" + v1, now.Add(-301 * time.Second), ErrBotEventTimestampOutOfRange},
		{"timestamp not a number", botEventTestSecret1, "abc", body, "v1=" + v1, now, ErrBotEventTimestampInvalid},
		{"timestamp empty", botEventTestSecret1, "", body, "v1=" + v1, now, ErrBotEventTimestampInvalid},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := VerifyBotEventSignature(tc.secret, tc.ts, tc.body, tc.header, tc.now)
			if tc.want == nil {
				require.NoError(t, err)
				return
			}
			assert.ErrorIs(t, err, tc.want)
		})
	}
}
