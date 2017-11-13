// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"testing"
)

func TestVersion(t *testing.T) {
	checkCommand(t, "version")
}
