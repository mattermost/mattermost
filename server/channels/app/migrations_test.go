// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/stretchr/testify/require"
	"testing"
)

func TestDoSetupContentFlaggingProperties(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("should register property group and fields", func(t *testing.T) {
		err := th.Server.doSetupContentFlaggingProperties()
		require.NoError(t, err)
	})
}
