// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook_template

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestLimitsAreSane(t *testing.T) {
	require.Equal(t, 128*1024, MaxBodyBytes)
	require.Equal(t, 1024*1024, MaxRenderedBytes)
	require.Equal(t, 100*time.Millisecond, MaxExecutionTime)
}
