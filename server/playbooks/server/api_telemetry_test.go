// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCreateEvent(t *testing.T) {
	e := Setup(t)
	e.CreateBasic()

	t.Run("create an event with bad type fails", func(t *testing.T) {
		err := e.PlaybooksClient.Telemetry.CreateEvent(context.Background(), "run_status_update", "bad_type", nil)
		require.Error(t, err)
	})

	t.Run("create an event with bad name fails", func(t *testing.T) {
		err := e.PlaybooksClient.Telemetry.CreateEvent(context.Background(), "bad_name", "page", nil)
		require.Error(t, err)
	})

	t.Run("create an event correctly with no extra data", func(t *testing.T) {
		err := e.PlaybooksClient.Telemetry.CreateEvent(context.Background(), "run_status_update", "page", nil)
		require.NoError(t, err)
	})

	t.Run("create an event correctly with extra data", func(t *testing.T) {
		extra := map[string]interface{}{
			"foo": "bar",
			"baz": 5,
		}
		err := e.PlaybooksClient.Telemetry.CreateEvent(context.Background(), "run_status_update", "page", extra)
		require.NoError(t, err)
	})
}
