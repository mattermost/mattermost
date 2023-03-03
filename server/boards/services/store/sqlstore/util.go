// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	sq "github.com/Masterminds/squirrel"

	"github.com/mattermost/mattermost-server/v6/boards/model"
	"github.com/mattermost/mattermost-server/v6/boards/utils"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

func (s *SQLStore) CloseRows(rows *sql.Rows) {
	if err := rows.Close(); err != nil {
		s.logger.Error("error closing MattermostAuthLayer row set", mlog.Err(err))
	}
}

func (s *SQLStore) IsErrNotFound(err error) bool {
	return model.IsErrNotFound(err)
}

func (s *SQLStore) MarshalJSONB(data interface{}) ([]byte, error) {
	b, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	if s.isBinaryParam {
		b = append([]byte{0x01}, b...)
	}

	return b, nil
}

func PrepareNewTestDatabase() (dbType string, connectionString string, err error) {
	dbType = strings.TrimSpace(os.Getenv("FOCALBOARD_STORE_TEST_DB_TYPE"))
	if dbType == "" {
		panic("Environment variable FOCALBOARD_STORE_TEST_DB_TYPE must be defined")
	}
	if dbType == "mariadb" {
		dbType = model.MysqlDBType
	}

	var dbName string
	var rootUser string

	if port := strings.TrimSpace(os.Getenv("FOCALBOARD_STORE_TEST_DOCKER_PORT")); port != "" {
		// docker unit tests take priority over any DSN env vars
		var template string
		switch dbType {
		case model.MysqlDBType:
			template = "%s:mostest@tcp(localhost:%s)/%s?charset=utf8mb4,utf8&writeTimeout=30s"
			rootUser = "root"
		case model.PostgresDBType:
			template = "postgres://%s:mostest@localhost:%s/%s?sslmode=disable\u0026connect_timeout=10"
			rootUser = "mmuser"
		default:
			return "", "", newErrInvalidDBType(dbType)
		}

		connectionString = fmt.Sprintf(template, rootUser, port, "")

		// create a new database each run
		sqlDB, err := sql.Open(dbType, connectionString)
		if err != nil {
			return "", "", fmt.Errorf("cannot connect to %s database: %w", dbType, err)
		}
		defer sqlDB.Close()

		err = sqlDB.Ping()
		if err != nil {
			return "", "", fmt.Errorf("cannot ping %s database: %w", dbType, err)
		}

		dbName = "testdb_" + utils.NewID(utils.IDTypeNone)[:8]
		_, err = sqlDB.Exec(fmt.Sprintf("CREATE DATABASE %s;", dbName))
		if err != nil {
			return "", "", fmt.Errorf("cannot create %s database %s: %w", dbType, dbName, err)
		}

		if dbType != model.PostgresDBType {
			_, err = sqlDB.Exec(fmt.Sprintf("GRANT ALL PRIVILEGES ON %s.* TO mmuser;", dbName))
			if err != nil {
				return "", "", fmt.Errorf("cannot grant permissions on %s database %s: %w", dbType, dbName, err)
			}
		}

		connectionString = fmt.Sprintf(template, "mmuser", port, dbName)
	} else {
		// mysql or postgres need a DSN (connection string)
		connectionString = strings.TrimSpace(os.Getenv("FOCALBOARD_STORE_TEST_CONN_STRING"))
	}

	return dbType, connectionString, nil
}

type ErrInvalidDBType struct {
	dbType string
}

func newErrInvalidDBType(dbType string) error {
	return ErrInvalidDBType{
		dbType: dbType,
	}
}

func (e ErrInvalidDBType) Error() string {
	return "unsupported database type: " + e.dbType
}

// deleteBoardRecord deletes a boards record without deleting any child records in the blocks table.
// FOR UNIT TESTING ONLY.
func (s *SQLStore) deleteBoardRecord(db sq.BaseRunner, boardID string, modifiedBy string) error {
	return s.deleteBoardAndChildren(db, boardID, modifiedBy, true)
}

// deleteBlockRecord deletes a blocks record without deleting any child records in the blocks table.
// FOR UNIT TESTING ONLY.
func (s *SQLStore) deleteBlockRecord(db sq.BaseRunner, blockID, modifiedBy string) error {
	return s.deleteBlockAndChildren(db, blockID, modifiedBy, true)
}

func (s *SQLStore) castInt(val int64, as string) string {
	if s.dbType == model.MysqlDBType {
		return fmt.Sprintf("cast(%d as unsigned) AS %s", val, as)
	}
	return fmt.Sprintf("cast(%d as bigint) AS %s", val, as)
}

func (s *SQLStore) GetSchemaName() (string, error) {
	var query sq.SelectBuilder

	switch s.dbType {
	case model.MysqlDBType:
		query = s.getQueryBuilder(s.db).Select("DATABASE()")
	case model.PostgresDBType:
		query = s.getQueryBuilder(s.db).Select("current_schema()")
	default:
		return "", ErrUnsupportedDatabaseType
	}

	scanner := query.QueryRow()

	var result string
	err := scanner.Scan(&result)
	if err != nil && !model.IsErrNotFound(err) {
		return "", err
	}

	return result, nil
}
