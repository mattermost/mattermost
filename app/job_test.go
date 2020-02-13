// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestGetJob(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	status := &model.Job{
		Id:     model.NewId(),
		Status: model.NewId(),
	}
	_, err := th.App.Srv.Store.Job().Save(status)
	require.Nil(t, err)

	defer th.App.Srv.Store.Job().Delete(status.Id)

	received, err := th.App.GetJob(status.Id)
	require.Nil(t, err)
	require.Equal(t, status, received, "incorrect job status received")
}

func TestGetJobByType(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	jobType := model.NewId()

	statuses := []*model.Job{
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: 1000,
		},
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: 999,
		},
		{
			Id:       model.NewId(),
			Type:     jobType,
			CreateAt: 1001,
		},
	}

	for _, status := range statuses {
		_, err := th.App.Srv.Store.Job().Save(status)
		require.Nil(t, err)
		defer th.App.Srv.Store.Job().Delete(status.Id)
	}

	received, err := th.App.GetJobsByType(jobType, 0, 2)
	require.Nil(t, err)
	require.Len(t, received, 2, "received wrong number of statuses")
	require.Equal(t, statuses[2], received[0], "should've received newest job first")
	require.Equal(t, statuses[0], received[1], "should've received second newest job second")

	received, err = th.App.GetJobsByType(jobType, 2, 2)
	require.Nil(t, err)
	require.Len(t, received, 1, "received wrong number of statuses")
	require.Equal(t, statuses[1], received[0], "should've received oldest job last")
}
