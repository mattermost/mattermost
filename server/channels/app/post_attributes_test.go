// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// TestPostAttributesPropertyGroupRegisteredAtStartup verifies that the
// post_attributes PSAv2 property group is registered unconditionally at
// server startup (via RegisterBuiltinGroups), independent of the
// PostAttributes feature flag, which only gates the generic Properties API
// route registration.
func TestPostAttributesPropertyGroupRegisteredAtStartup(t *testing.T) {
	th := Setup(t)

	group, appErr := th.App.GetPropertyGroup(th.Context, model.PostAttributesPropertyGroupName)
	require.Nil(t, appErr)
	require.NotNil(t, group)
	require.NotEmpty(t, group.ID)
	require.Equal(t, model.PostAttributesPropertyGroupName, group.Name)
	require.Equal(t, model.PropertyGroupVersionV2, group.Version)
}
