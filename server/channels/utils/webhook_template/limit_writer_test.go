// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook_template

import (
	"bytes"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLimitWriter_BelowCap(t *testing.T) {
	var buf bytes.Buffer
	lw := newLimitWriter(&buf, 10)
	n, err := lw.Write([]byte("hello"))
	require.NoError(t, err)
	require.Equal(t, 5, n)
	require.Equal(t, "hello", buf.String())
}

func TestLimitWriter_ExactlyAtCap(t *testing.T) {
	var buf bytes.Buffer
	lw := newLimitWriter(&buf, 5)
	n, err := lw.Write([]byte("hello"))
	require.NoError(t, err)
	require.Equal(t, 5, n)
	require.Equal(t, "hello", buf.String())
}

func TestLimitWriter_OneByteOver(t *testing.T) {
	var buf bytes.Buffer
	lw := newLimitWriter(&buf, 5)
	n, err := lw.Write([]byte("hellox"))
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrOutputTooLarge))
	// Underlying writer keeps the bytes we wrote up to the limit; the
	// truncation behaviour is intentional so partial output is visible
	// for debugging but the error still propagates.
	require.LessOrEqual(t, n, 5)
	require.LessOrEqual(t, buf.Len(), 5)
}

func TestLimitWriter_MultipleWritesCrossingCap(t *testing.T) {
	var buf bytes.Buffer
	lw := newLimitWriter(&buf, 6)
	n, err := lw.Write([]byte("abc"))
	require.NoError(t, err)
	require.Equal(t, 3, n)

	n, err = lw.Write([]byte("def"))
	require.NoError(t, err)
	require.Equal(t, 3, n)
	require.Equal(t, "abcdef", buf.String())

	_, err = lw.Write([]byte("g"))
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrOutputTooLarge))
}

func TestLimitWriter_RemainsErrorAfterLimit(t *testing.T) {
	var buf bytes.Buffer
	lw := newLimitWriter(&buf, 3)
	_, err := lw.Write([]byte("abcd"))
	require.Error(t, err)

	// Subsequent writes should also error.
	_, err = lw.Write([]byte("xyz"))
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrOutputTooLarge))
}

func TestLimitWriter_StreamCopy(t *testing.T) {
	var buf bytes.Buffer
	lw := newLimitWriter(&buf, 1024)
	src := strings.NewReader(strings.Repeat("x", 2000))
	_, err := io.Copy(lw, src)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrOutputTooLarge))
	require.LessOrEqual(t, buf.Len(), 1024)
}
