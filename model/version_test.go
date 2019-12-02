// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSplitVersion(t *testing.T) {
	major1, minor1, patch1 := SplitVersion("junk")
	require.EqualValues(t, 0, major1)
	require.EqualValues(t, 0, minor1)
	require.EqualValues(t, 0, patch1)

	major2, minor2, patch2 := SplitVersion("1.2.3")
	require.EqualValues(t, 1, major2)
	require.EqualValues(t, 2, minor2)
	require.EqualValues(t, 3, patch2)

	major3, minor3, patch3 := SplitVersion("1.2")
	require.EqualValues(t, 1, major3)
	require.EqualValues(t, 2, minor3)
	require.EqualValues(t, 0, patch3)

	major4, minor4, patch4 := SplitVersion("1")
	require.EqualValues(t, 1, major4)
	require.EqualValues(t, 0, minor4)
	require.EqualValues(t, 0, patch4)

	major5, minor5, patch5 := SplitVersion("1.2.3.junkgoeswhere")
	require.EqualValues(t, 1, major5)
	require.EqualValues(t, 2, minor5)
	require.EqualValues(t, 3, patch5)
}

func TestGetPreviousVersion(t *testing.T) {
	require.Equal(t, "1.2.0", GetPreviousVersion("1.3.0"))
	require.Equal(t, "1.1.0", GetPreviousVersion("1.2.1"))
	require.Equal(t, "1.0.0", GetPreviousVersion("1.1.0"))
	require.Equal(t, "0.7.0", GetPreviousVersion("1.0.0"))
	require.Equal(t, "0.6.0", GetPreviousVersion("0.7.1"))
	require.Equal(t, "", GetPreviousVersion("0.5.0"))
}

func TestIsCurrentVersion(t *testing.T) {
	major, minor, patch := SplitVersion(CurrentVersion)

	require.True(t, IsCurrentVersion(CurrentVersion))
	require.True(t, IsCurrentVersion(fmt.Sprintf("%v.%v.%v", major, minor, patch+100)))
	require.False(t, IsCurrentVersion(fmt.Sprintf("%v.%v.%v", major, minor+1, patch)))
	require.False(t, IsCurrentVersion(fmt.Sprintf("%v.%v.%v", major+1, minor, patch)))
}

func TestIsPreviousVersionsSupported(t *testing.T) {
	require.True(t, IsPreviousVersionsSupported(versionsWithoutHotFixes[0]))
	require.True(t, IsPreviousVersionsSupported(versionsWithoutHotFixes[1]))
	require.True(t, IsPreviousVersionsSupported(versionsWithoutHotFixes[2]))
	require.False(t, IsPreviousVersionsSupported(versionsWithoutHotFixes[4]))
	require.False(t, IsPreviousVersionsSupported(versionsWithoutHotFixes[5]))
}
