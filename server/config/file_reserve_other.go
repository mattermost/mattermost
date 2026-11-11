// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !linux

package config

import "os"

// reserveSpace does nothing outside Linux, which is the only platform supported in production.
func reserveSpace(*os.File, int64) error {
	return nil
}
