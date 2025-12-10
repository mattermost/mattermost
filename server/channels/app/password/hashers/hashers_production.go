// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build production

package hashers

// getLatestHasher returns the hasher to use for password operations.
// In production builds, this always returns the latestHasher.
func getLatestHasher() PasswordHasher {
	return latestHasher
}
