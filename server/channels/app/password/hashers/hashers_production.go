// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build production

package hashers

// GetLatestHasher returns the hasher to use for password operations.
// In production builds, this always returns the latestHasher.
func GetLatestHasher() PasswordHasher {
	return latestHasher
}
