// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJSONArray(t *testing.T) {
	input := []string{"a", "b"}

	out, err := jsonArray(input).Value()
	require.NoError(t, err)
	outBuf, ok := out.([]byte)
	require.True(t, ok)
	assert.Equal(t, []byte(`["a","b"]`), outBuf)
}
