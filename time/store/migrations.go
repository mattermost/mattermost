// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package store

import (
	"github.com/blang/semver"
	"github.com/jmoiron/sqlx"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/model"
)

type Migration struct {
	fromVersion   semver.Version
	toVersion     semver.Version
	migrationFunc func(sqlx.Ext, *SQLStore) error
}

const MySQLCharset = "DEFAULT CHARACTER SET utf8mb4"

var migrations = []Migration{
	{
		fromVersion: semver.MustParse("0.0.0"),
		toVersion:   semver.MustParse("0.1.0"),
		migrationFunc: func(e sqlx.Ext, sqlStore *SQLStore) error {
			if e.DriverName() == model.DatabaseDriverMysql {
				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS TIME_System (
						SKey VARCHAR(64) PRIMARY KEY,
						SValue VARCHAR(1024) NULL
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table TIME_System")
				}

				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS TIME_Task (
						ID VARCHAR(26) PRIMARY KEY,
						Title VARCHAR(1024) NOT NULL,
						Complete BOOLEAN NOT NULL,
						BlockID VARCHAR(26) NOT NULL,
						StartAt BIGINT NOT NULL,
						Tags TEXT NOT NULL,
						INDEX TIME_Task_BlockID (BlockID),
					)
				` + MySQLCharset); err != nil {
					return errors.Wrapf(err, "failed creating table TIME_Task")
				}

			} else {

				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS TIME_System (
						SKey VARCHAR(64) PRIMARY KEY,
						SValue VARCHAR(1024) NULL
					);
				`); err != nil {
					return errors.Wrapf(err, "failed creating table TIME_System")
				}

				if _, err := e.Exec(`
					CREATE TABLE IF NOT EXISTS TIME_Task (
						ID TEXT PRIMARY KEY,
						Title TEXT NOT NULL,
						Complete BOOLEAN NOT NULL,
						BlockID TEXT NOT NULL,
						StartAt BIGINT NOT NULL,
						Tags JSON NOT NULL
					);
				`); err != nil {
					return errors.Wrapf(err, "failed creating table TIME_Task")
				}

				if _, err := e.Exec(createPGIndex("TIME_Task_BlockID", "TIME_Task", "BlockID")); err != nil {
					return errors.Wrapf(err, "failed creating index TIME_Task_BlockID ")
				}
			}

			return nil
		},
	},
}
