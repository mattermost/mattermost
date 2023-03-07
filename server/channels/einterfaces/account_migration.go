// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/server/v7/model"
)

type AccountMigrationInterface interface {
	MigrateToLdap(fromAuthService string, foreignUserFieldNameToMatch string, force bool, dryRun bool) *model.AppError
	MigrateToSaml(fromAuthService string, usersMap map[string]string, auto bool, dryRun bool) *model.AppError
}
