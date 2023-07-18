// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestJobAuditable(t *testing.T) {
	job := &Job{
		Id:             "arandomstring0123456789012",
		Type:           JobTypeExportProcess,
		Priority:       42,
		CreateAt:       1336,
		StartAt:        1337,
		LastActivityAt: 1666609360813,
		Status:         JobStatusInProgress,
		Progress:       32,
		Data:           StringMap{"Hello": "World"},
	}

	audit := job.Auditable()

	require.Equal(t, job.Id, audit["id"])
	require.Equal(t, job.Type, audit["type"])
	require.Equal(t, job.Priority, audit["priority"])
	require.Equal(t, job.CreateAt, audit["create_at"])
	require.Equal(t, job.StartAt, audit["start_at"])
	require.Equal(t, job.LastActivityAt, audit["last_activity_at"])
	require.Equal(t, job.Status, audit["status"])
	require.Equal(t, job.Progress, audit["progress"])
	require.Equal(t, job.Data, audit["data"])
}

func TestJobIsValid(t *testing.T) {
	t.Run("valid", func(t *testing.T) {
		job := &Job{
			Id:             "arandomstring0123456789012",
			Type:           JobTypeExportProcess,
			Priority:       42,
			CreateAt:       1336,
			StartAt:        1337,
			LastActivityAt: 1666609360813,
			Status:         JobStatusInProgress,
			Progress:       32,
			Data:           StringMap{"Hello": "World"},
		}

		require.Nil(t, job.IsValid())
	})

	t.Run("invalid ID", func(t *testing.T) {
		job := &Job{
			Id:             "invalid!",
			Type:           JobTypeExportProcess,
			Priority:       42,
			CreateAt:       1336,
			StartAt:        1337,
			LastActivityAt: 1666609360813,
			Status:         JobStatusInProgress,
			Progress:       32,
			Data:           StringMap{"Hello": "World"},
		}

		require.NotNil(t, job.IsValid())
	})

	t.Run("invalid creation time", func(t *testing.T) {
		job := &Job{
			Id:             "arandomstring0123456789012",
			Type:           JobTypeExportProcess,
			Priority:       42,
			CreateAt:       0,
			StartAt:        1337,
			LastActivityAt: 1666609360813,
			Status:         JobStatusInProgress,
			Progress:       32,
			Data:           StringMap{"Hello": "World"},
		}

		require.NotNil(t, job.IsValid())
	})

	t.Run("invalid status", func(t *testing.T) {
		job := &Job{
			Id:             "arandomstring0123456789012",
			Type:           JobTypeExportProcess,
			Priority:       42,
			CreateAt:       1336,
			StartAt:        1337,
			LastActivityAt: 1666609360813,
			Status:         "doing the best it can",
			Progress:       32,
			Data:           StringMap{"Hello": "World"},
		}

		require.NotNil(t, job.IsValid())
	})

	t.Run("valid status", func(t *testing.T) {
		validStatuses := []string{JobStatusCancelRequested, JobStatusCanceled, JobStatusError, JobStatusInProgress, JobStatusPending, JobStatusSuccess, JobStatusWarning}
		for _, status := range validStatuses {
			t.Run(status, func(t *testing.T) {
				job := &Job{
					Id:             "arandomstring0123456789012",
					Type:           JobTypeExportProcess,
					Priority:       42,
					CreateAt:       1336,
					StartAt:        1337,
					LastActivityAt: 1666609360813,
					Status:         status,
					Progress:       32,
					Data:           StringMap{"Hello": "World"},
				}

				require.Nil(t, job.IsValid())
			})
		}
	})
}
