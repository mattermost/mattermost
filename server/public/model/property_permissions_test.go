// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPropertyActionConstants(t *testing.T) {
	// The wire strings are the grid cells clients and stored grants name; they
	// are part of the contract, so pin them.
	assert.Equal(t, "field.write", PropertyActionFieldWrite)
	assert.Equal(t, "option.read", PropertyActionOptionRead)
	assert.Equal(t, "option.write", PropertyActionOptionWrite)
	assert.Equal(t, "value.read", PropertyActionValueRead)
	assert.Equal(t, "value.write", PropertyActionValueWrite)
}

func TestPermissionLevelEveryoneIsValid(t *testing.T) {
	pf := &PropertyField{
		ID:         NewId(),
		GroupID:    NewId(),
		Name:       "test field",
		Type:       PropertyFieldTypeText,
		ObjectType: PropertyFieldObjectTypePost,
		TargetType: string(PropertyFieldTargetLevelSystem),
		CreateAt:   GetMillis(),
		UpdateAt:   GetMillis(),
	}
	pf.PermissionValues = new(PermissionLevelEveryone)
	require.NoError(t, pf.IsValid())
}
