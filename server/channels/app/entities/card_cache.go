// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package entities

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	maxCacheTTLSeconds = 24 * 60 * 60
	defaultCacheTTL    = 30 * time.Minute
)

func normalizeCache(mode string, ttlSeconds int) (string, time.Duration, error) {
	switch mode {
	case "", model.EntityCacheNone:
		return model.EntityCacheNone, 0, nil
	case model.EntityCacheShared, model.EntityCacheUser:
	default:
		return "", 0, fmt.Errorf("cache is not allowed")
	}
	if ttlSeconds < 0 || ttlSeconds > maxCacheTTLSeconds {
		return "", 0, fmt.Errorf("cache ttl is not allowed")
	}
	ttl := time.Duration(ttlSeconds) * time.Second
	if ttl == 0 {
		ttl = defaultCacheTTL
	}
	return mode, ttl, nil
}

// CardCacheKey is the storage key for a provider card. The boolean is false
// when the provider asked not to cache, or when a per-user card has no reader.
func CardCacheKey(providerID, mode, typeID, value, userID string) (string, bool) {
	switch mode {
	case model.EntityCacheShared:
		return cacheDigest(providerID, typeID, value), true
	case model.EntityCacheUser:
		if userID == "" {
			return "", false
		}
		return cacheDigest(providerID, typeID, value, userID), true
	default:
		return "", false
	}
}

func cacheDigest(parts ...string) string {
	h := sha256.New()
	for _, part := range parts {
		fmt.Fprintf(h, "%s\n", part)
	}
	return hex.EncodeToString(h.Sum(nil))
}
