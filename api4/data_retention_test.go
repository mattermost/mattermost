// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"testing"
)

func TestDataRetentionGetPolicy(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	_, resp := th.Client.GetDataRetentionPolicy()
	CheckNotImplementedStatus(t, resp)
}
