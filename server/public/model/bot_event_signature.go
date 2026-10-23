// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"time"
)

const (
	BotEventHeaderEventId      = "X-Mattermost-Event-Id"
	BotEventHeaderBotId        = "X-Mattermost-Bot-Id"
	BotEventHeaderTimestamp    = "X-Mattermost-Timestamp"
	BotEventHeaderSignature    = "X-Mattermost-Signature"
	BotEventSignatureTolerance = 5 * time.Minute

	botEventSignaturePrefix = "v1="
)

var (
	ErrBotEventSignatureMissing    = errors.New("bot event signature is missing")
	ErrBotEventSignatureMismatch   = errors.New("bot event signature does not match")
	ErrBotEventTimestampInvalid    = errors.New("bot event timestamp is invalid")
	ErrBotEventTimestampOutOfRange = errors.New("bot event timestamp is outside the allowed tolerance")
)

// SignBotEventPayload returns "v1=" + hex(HMAC-SHA256(secret, "v1:" + timestamp + ":" + body)),
// where timestamp is in unix seconds.
func SignBotEventPayload(secret string, timestamp int64, body []byte) string {
	return botEventSignaturePrefix + hex.EncodeToString(botEventMAC(secret, timestamp, body))
}

func botEventMAC(secret string, timestamp int64, body []byte) []byte {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte("v1:" + strconv.FormatInt(timestamp, 10) + ":"))
	mac.Write(body)
	return mac.Sum(nil)
}

// VerifyBotEventSignature checks the signature header against the raw request body. The
// header may carry several comma-separated "v1=" signatures; any match is enough.
func VerifyBotEventSignature(secret, timestampHeader string, body []byte, signatureHeader string, now time.Time) error {
	ts, err := strconv.ParseInt(timestampHeader, 10, 64)
	if err != nil {
		return ErrBotEventTimestampInvalid
	}
	if diff := now.Sub(time.Unix(ts, 0)); diff > BotEventSignatureTolerance || diff < -BotEventSignatureTolerance {
		return ErrBotEventTimestampOutOfRange
	}

	want := botEventMAC(secret, ts, body)
	found := false
	for part := range strings.SplitSeq(signatureHeader, ",") {
		part = strings.TrimSpace(part)
		if !strings.HasPrefix(part, botEventSignaturePrefix) {
			continue
		}
		found = true

		got, err := hex.DecodeString(strings.TrimPrefix(part, botEventSignaturePrefix))
		if err != nil {
			continue
		}
		if hmac.Equal(got, want) {
			return nil
		}
	}

	if !found {
		return ErrBotEventSignatureMissing
	}
	return ErrBotEventSignatureMismatch
}
