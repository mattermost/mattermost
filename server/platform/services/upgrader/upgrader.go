// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !linux
// +build !linux

package upgrader

func CanIUpgradeToE0() error {
	return &InvalidArch{}
}

func UpgradeToE0() error {
	return &InvalidArch{}
}

func UpgradeToE0Status() (int64, error) {
	return 0, &InvalidArch{}
}
