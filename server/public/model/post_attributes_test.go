// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPostAttributesPropertyGroupNameIsValid(t *testing.T) {
	require.True(t, IsValidPropertyGroupName(PostAttributesPropertyGroupName))
}
