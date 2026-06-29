// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !linux && !darwin

package platform

// getOpenFileDescriptors returns -1 on unsupported platforms.
func getOpenFileDescriptors() (int64, error) {
	return -1, nil
}

// getMaxFileDescriptors returns -1 on unsupported platforms.
func getMaxFileDescriptors() (int64, error) {
	return -1, nil
}
