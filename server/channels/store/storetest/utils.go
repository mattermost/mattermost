// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
)

// This function has a copy of it in app/helper_test
// NewTestID is used for testing as a replacement for model.NewId(). It is a [A-Z0-9] string 26
// characters long. It replaces every odd character with a digit.
func NewTestID() string {
	newID := []byte(model.NewId())

	for i := 1; i < len(newID); i = i + 2 {
		newID[i] = 48 + newID[i-1]%10
	}

	return string(newID)
}

// Adds backtiks to the column name for MySQL, this is required if
// the column name is a reserved keyword.
//
//	`ColumnName` -  MySQL
//	ColumnName   -  Postgres
func quoteColumnName(driver string, columnName string) string {
	if driver == model.DatabaseDriverMysql {
		return fmt.Sprintf("`%s`", columnName)
	}

	return columnName
}
