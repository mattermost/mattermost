// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import "github.com/mattermost/mattermost-server/v5/model"

type AccountMigrationInterface interface {
	MigrateToLdap(fromAuthService string, forignUserFieldNameToMatch string, force bool, dryRun bool) *model.AppError
	MigrateToSaml(fromAuthService string, usersMap map[string]string, auto bool, dryRun bool) *model.AppError
}
