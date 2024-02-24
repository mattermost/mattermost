// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package combine_desktop_mobile_user_threads_setting

import (
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/pkg/errors"
)

const timeBetweenBatches = 100 * time.Second

func MakeWorker(jobServer *jobs.JobServer, store store.Store, app jobs.BatchMigrationWorkerAppIFace) model.Worker {
	return jobs.MakeBatchMigrationWorker(
		jobServer,
		store,
		app,
		model.MigrationKeyAddCombineDesktopMobileUserThreadsSetting,
		timeBetweenBatches,
		doCombineDesktopMobileUserThreadSettingMigrationBatch,
	)
}

func parseJobMetadata(data model.StringMap) (string, int64, error) {
	userId := data["user_id"]

	createAt := int64(0)
	if data["create_at"] != "" {
		createAt, err := strconv.ParseInt(data["create_at"], 10, 64)
		if err != nil {
			return "", 0, err
		}

		return userId, createAt, nil
	}

	return userId, createAt, nil
}

func doCombineDesktopMobileUserThreadSettingMigrationBatch(data model.StringMap, store store.Store) (model.StringMap, bool, error) {
	userId, createAt, err := parseJobMetadata(data)
	if err != nil {
		return nil, false, err
	}

	nextUserId, nextCreateAt, err := store.User().GetNextUserIdAndCreateAtForCombineDesktopMobileUserThreadSettingMigration(userId, createAt)
	if err != nil {
		return nil, false, err
	}

	// If nextUserId is empty and nextCreateAt is 0, then we have migrated all the users
	if nextUserId == "" && nextCreateAt == 0 {
		return nil, true, nil
	}

	err = store.User().CombineDesktopMobileUserThreadsSetting(userId, createAt)
	if err != nil {
		return nil, false, errors.Wrap(err, "failed to combine desktop and mobile user threads setting")
	}

	return nil, false, nil
}
