// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"
)

func TestDataRetentionGetPolicy(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	_, resp := th.Client.GetDataRetentionPolicy()
	CheckNotImplementedStatus(t, resp)
}
