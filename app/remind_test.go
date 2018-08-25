// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"testing"
	"github.com/mattermost/mattermost-server/model"
)

func TestInit(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.InitReminders()
}

func TestStop(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.StopReminders()
}

func TestListReminders(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	list := th.App.ListReminders("user_id")
	if list == "" {
		t.Fatal("list should not be empty")
	}
}

func TestDeleteReminders(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.DeleteReminders("user_id")
}

func TestScheduleReminder(t *testing.T) {
	th := Setup()
	defer th.TearDown()

	th.App.ScheduleReminder(&model.ReminderRequest{})
}
