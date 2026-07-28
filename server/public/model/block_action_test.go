// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNormalizeBlockActionSubtype(t *testing.T) {
	assert.Equal(t, BlockActionSubtypeExecute, NormalizeBlockActionSubtype(""))
	assert.Equal(t, BlockActionSubtypeExecute, NormalizeBlockActionSubtype("execute"))
	assert.Equal(t, BlockActionSubtypeExecute, NormalizeBlockActionSubtype("EXECUTE"))
	assert.Equal(t, BlockActionSubtypeLookup, NormalizeBlockActionSubtype("lookup"))
	assert.Equal(t, BlockActionSubtypeLookup, NormalizeBlockActionSubtype(" Lookup "))
	assert.Equal(t, "", NormalizeBlockActionSubtype("submit"))
	assert.Equal(t, "", NormalizeBlockActionSubtype("unknown"))
}

func TestNormalizeBlockActionContext(t *testing.T) {
	assert.Equal(t, BlockActionContextPost, NormalizeBlockActionContext("post"))
	assert.Equal(t, BlockActionContextPost, NormalizeBlockActionContext("POST"))
	assert.Equal(t, BlockActionContextDialog, NormalizeBlockActionContext("dialog"))
	assert.Equal(t, BlockActionContextDialog, NormalizeBlockActionContext(" Dialog "))
	assert.Equal(t, "", NormalizeBlockActionContext(""))
	assert.Equal(t, "", NormalizeBlockActionContext("unknown"))
}

