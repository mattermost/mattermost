// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDataRetentionGetPolicy(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	_, resp, err := th.Client.GetDataRetentionPolicy()
	require.Error(t, err)
	CheckNotImplementedStatus(t, resp)
}
