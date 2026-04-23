// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"github.com/mattermost/mattermost/server/public/model"
)

func makeEmail() string {
	return "success_" + model.NewId() + "@simulator.amazonses.com"
}

// newTestID returns a [A-Z0-9] string 26 characters long suitable for use as a
// test identifier. Every odd character is replaced with a digit derived from the
// preceding character so the result satisfies the pattern (letter digit)*.
func newTestID() string {
	newID := []byte(model.NewId())
	for i := 1; i < len(newID); i = i + 2 {
		newID[i] = 48 + newID[i-1]%10
	}
	return string(newID)
}

// quoteColumnName returns the column name for PostgreSQL.
func quoteColumnName(_ string, columnName string) string {
	return columnName
}
