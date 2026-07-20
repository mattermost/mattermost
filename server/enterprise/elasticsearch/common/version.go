// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"strconv"
	"strings"
)

func GetVersionComponents(version string) (int, int, int, error) {
	spl := strings.Split(version, ".")
	major, err := strconv.Atoi(spl[0])
	if err != nil {
		return 0, 0, 0, err
	}
	minor, err := strconv.Atoi(spl[1])
	if err != nil {
		return 0, 0, 0, err
	}
	patch, err := strconv.Atoi(spl[2])
	if err != nil {
		return 0, 0, 0, err
	}

	return major, minor, patch, nil
}
