// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package einterfaces

import "github.com/mattermost/platform/model"

type AccountMigrationInterface interface {
	MigrateToLdap(fromAuthService string, forignUserFieldNameToMatch string) *model.AppError
}

var theAccountMigrationInterface AccountMigrationInterface

func RegisterAccountMigrationInterface(newInterface AccountMigrationInterface) {
	theAccountMigrationInterface = newInterface
}

func GetAccountMigrationInterface() AccountMigrationInterface {
	return theAccountMigrationInterface
}
