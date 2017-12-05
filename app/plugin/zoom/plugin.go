// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// +build !amd64 !darwin,!linux,!windows

package zoom

func Asset(name string) ([]byte, error) {
	return nil, nil
}
