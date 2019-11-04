// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

// TokenBucketInterface defines an interface for a token bucket algorithm.
type TokenBucketInterface interface {
	Take() error
	Done()
}
