// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"regexp"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewTestId(t *testing.T) {
	rg := regexp.MustCompile(`(\S\d){13}`)

	for i := 0; i < 1000; i++ {
		id := NewTestId()
		require.LessOrEqual(t, len(id), 26, "ids shouldn't be longer than 26 chars")
		require.Regexp(t, rg, id)
	}
}
