// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !linux && !darwin

package platform

import "errors"

// ErrHostUptimeUnsupportedPlatform is returned when host uptime detection is not supported on the current platform.
var ErrHostUptimeUnsupportedPlatform = errors.New("host uptime detection not supported on this platform")

// getHostUptimeSeconds returns an error on non-Linux platforms.
func getHostUptimeSeconds() (int64, error) {
	return 0, ErrHostUptimeUnsupportedPlatform
}
