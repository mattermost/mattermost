// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestSystemJson(t *testing.T) {
	system := System{Name: "test", Value: NewId()}
	json := system.ToJson()
	result := SystemFromJson(strings.NewReader(json))

	require.Equal(t, "test", result.Name, "ids do not match")
}

func TestServerBusyJson(t *testing.T) {
	now := time.Now()
	sbs := ServerBusyState{Busy: true, Expires: now.Unix()}
	json := sbs.ToJson()
	result := ServerBusyStateFromJson(strings.NewReader(json))

	require.Equal(t, sbs.Busy, result.Busy, "busy state does not match")
	require.Equal(t, sbs.Expires, result.Expires, "expiry does not match")
}
