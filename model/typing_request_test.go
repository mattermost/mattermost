// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTypingRequestJson(t *testing.T) {
	o := TypingRequest{ChannelId: NewId(), ParentId: NewId()}
	json := o.ToJson()
	ro := TypingRequestFromJson(strings.NewReader(json))

	require.Equal(t, o.ChannelId, ro.ChannelId, "ChannelIds do not match")
	require.Equal(t, o.ParentId, ro.ParentId, "ParentIds do not match")
}
