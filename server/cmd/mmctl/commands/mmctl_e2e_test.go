// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build e2e
// +build e2e

package commands

import (
	"testing"

	"github.com/stretchr/testify/suite"
)

func TestMmctlE2ESuite(t *testing.T) {
	suite.Run(t, new(MmctlE2ETestSuite))
}
