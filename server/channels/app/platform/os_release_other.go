// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !linux && !darwin

package platform

import "github.com/mattermost/mattermost/server/public/model"

// The host OS details are only collected on Linux and macOS; elsewhere they are left out of the packet.

func getOSRelease() (*model.SupportPacketOSRelease, error) {
	return nil, nil
}

func getKernelRelease() (*string, error) {
	return nil, nil
}

func getRunningInContainer(string) (*bool, error) {
	return nil, nil
}
