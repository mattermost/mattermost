// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMEChannelKeyPreSaveSetsTimestamps(t *testing.T) {
	k := &MEChannelKey{
		ChannelID:  NewId(),
		WrappedDEK: []byte("wrapped"),
		KeyID:      "kek-label/v1",
	}
	k.PreSave()
	require.NotZero(t, k.CreateAt, "PreSave must set CreateAt")
	require.Equal(t, k.CreateAt, k.UpdateAt, "PreSave must initialize UpdateAt to CreateAt")
}

func TestMEChannelKeyPreSavePreservesExistingCreateAt(t *testing.T) {
	k := &MEChannelKey{
		ChannelID:  NewId(),
		WrappedDEK: []byte("wrapped"),
		KeyID:      "kek-label",
		CreateAt:   42,
	}
	k.PreSave()
	require.Equal(t, int64(42), k.CreateAt, "PreSave must not overwrite a non-zero CreateAt")
	require.Equal(t, int64(42), k.UpdateAt, "PreSave must initialize UpdateAt from CreateAt")
}

func TestMEChannelKeyPreUpdateRefreshesUpdateAt(t *testing.T) {
	k := &MEChannelKey{
		ChannelID:  NewId(),
		WrappedDEK: []byte("wrapped"),
		KeyID:      "kek-label",
		CreateAt:   1,
		UpdateAt:   1,
	}
	k.PreUpdate()
	require.NotEqual(t, int64(1), k.UpdateAt, "PreUpdate must refresh UpdateAt")
	require.Equal(t, int64(1), k.CreateAt, "PreUpdate must not touch CreateAt")
}

func TestMEChannelKeyWrappedDEKNotMarshaled(t *testing.T) {
	k := &MEChannelKey{
		ChannelID:  "channel-id",
		WrappedDEK: []byte("secret-wrapped-dek"),
		KeyID:      "kek-label",
		CreateAt:   1,
		UpdateAt:   2,
	}
	b, err := json.Marshal(k)
	require.NoError(t, err)
	require.NotContains(t, string(b), "secret-wrapped-dek", "WrappedDEK must never appear in JSON output")
	require.NotContains(t, string(b), "wrapped_dek", "WrappedDEK field must be json:\"-\"")
}
