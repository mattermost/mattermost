// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package targets

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestNoopFormatter(t *testing.T) {
	f := NoopFormatter{}
	require.False(t, f.IsStacktraceNeeded())

	t.Run("nil buffer allocates an empty one", func(t *testing.T) {
		buf, err := f.Format(nil, mlog.LvlAuditPostDelivery, nil)
		require.NoError(t, err)
		require.NotNil(t, buf)
		require.Zero(t, buf.Len())
	})

	t.Run("provided buffer is returned untouched", func(t *testing.T) {
		buf := &bytes.Buffer{}
		out, err := f.Format(nil, mlog.LvlAuditPostDelivery, buf)
		require.NoError(t, err)
		require.Same(t, buf, out)
		require.Zero(t, out.Len())
	})
}
