// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"testing"
)

func TestVersion(t *testing.T) {
	th := SetupWithStoreMock(t)
	defer th.TearDown()

	th.CheckCommand(t, "version")
}
