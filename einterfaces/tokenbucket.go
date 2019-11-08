// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

// TokenBucket defines an interface for token bucket algorithm (https://en.wikipedia.org/wiki/Token_bucket).
type TokenBucket interface {
	// Take removes a token from the bucket.
	Take() error
}
