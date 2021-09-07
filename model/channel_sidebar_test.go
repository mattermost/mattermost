// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsValidCategoryId(t *testing.T) {
	for _, test := range []struct {
		Name     string
		Input    string
		Expected bool
	}{
		{
			Name:     "should accept a regular ID",
			Input:    NewId(),
			Expected: true,
		},
		{
			Name:     "should accept a favorites ID",
			Input:    fmt.Sprintf("favorites_%s_%s", NewId(), NewId()),
			Expected: true,
		},
		{
			Name:     "should accept a channels ID",
			Input:    fmt.Sprintf("channels_%s_%s", NewId(), NewId()),
			Expected: true,
		},
		{
			Name:     "should accept a direct messages ID",
			Input:    fmt.Sprintf("direct_messages_%s_%s", NewId(), NewId()),
			Expected: true,
		},
		{
			Name:     "should reject a garbage ID",
			Input:    "a garbage ID",
			Expected: false,
		},
	} {
		t.Run(test.Name, func(t *testing.T) {
			assert.Equal(t, test.Expected, IsValidCategoryId(test.Input))
		})
	}
}
