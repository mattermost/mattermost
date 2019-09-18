// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

type AccountMigrationInterface interface {
	MigrateToLdap(fromAuthService string, forignUserFieldNameToMatch string, force bool, dryRun bool) error
	MigrateToSaml(fromAuthService string, usersMap map[string]string, auto bool, dryRun bool) error
}
