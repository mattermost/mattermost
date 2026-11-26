// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build darwin

package platform

import (
	"fmt"

	"golang.org/x/sys/unix"

	"github.com/mattermost/mattermost/server/public/model"
)

// getOSRelease describes macOS in the os-release shape, e.g. ID "macos", VERSION_ID "15.1"
// and PRETTY_NAME "macOS 15.1 (24B83)".
func getOSRelease() (*model.SupportPacketOSRelease, error) {
	productVersion, err := unix.Sysctl("kern.osproductversion")
	if err != nil {
		return nil, fmt.Errorf("failed to get kern.osproductversion: %w", err)
	}
	build, err := unix.Sysctl("kern.osversion")
	if err != nil {
		return nil, fmt.Errorf("failed to get kern.osversion: %w", err)
	}
	return macOSRelease(productVersion, build), nil
}

func macOSRelease(productVersion, build string) *model.SupportPacketOSRelease {
	return &model.SupportPacketOSRelease{
		ID:         "macos",
		VersionID:  productVersion,
		PrettyName: fmt.Sprintf("macOS %s (%s)", productVersion, build),
	}
}

// getRunningInContainer reports false: containers run Linux, so a macOS process is never in one.
func getRunningInContainer(string) (*bool, error) {
	return new(false), nil
}
