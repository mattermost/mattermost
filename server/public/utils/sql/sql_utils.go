// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sql

import (
	"context"
	dbsql "database/sql"
	"net/url"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/pkg/errors"
)

const (
	DBPingTimeout    = 10 * time.Second
	DBConnRetrySleep = 2 * time.Second

	replicaLagPrefix = "replica-lag"
)

// ResetReadTimeout removes the timeout constraint from the MySQL dsn.
func ResetReadTimeout(dataSource string) (string, error) {
	config, err := mysql.ParseDSN(dataSource)
	if err != nil {
		return "", err
	}
	config.ReadTimeout = 0
	return config.FormatDSN(), nil
}

// AppendMultipleStatementsFlag attached dsn parameters to MySQL dsn in order to make migrations work.
func AppendMultipleStatementsFlag(dataSource string) (string, error) {
	config, err := mysql.ParseDSN(dataSource)
	if err != nil {
		return "", err
	}

	if config.Params == nil {
		config.Params = map[string]string{}
	}

	config.Params["multiStatements"] = "true"
	return config.FormatDSN(), nil
}

// SetupConnection sets up the connection to the database and pings it to make sure it's alive.
// It also applies any database configuration settings that are required.
func SetupConnection(logger mlog.LoggerIFace, connType string, dataSource string, settings *model.SqlSettings, attempts int) (*dbsql.DB, error) {
	db, err := dbsql.Open(*settings.DriverName, dataSource)
	if err != nil {
		return nil, errors.Wrap(err, "failed to open SQL connection")
	}

	// At this point, we have passed sql.Open, so we deliberately ignore any errors.
	sanitized, _ := SanitizeDataSource(*settings.DriverName, dataSource)

	logger = logger.With(
		mlog.String("database", connType),
		mlog.String("dataSource", sanitized),
	)

	for i := 0; i < attempts; i++ {
		logger.Info("Pinging SQL")
		ctx, cancel := context.WithTimeout(context.Background(), DBPingTimeout)
		defer cancel()
		err = db.PingContext(ctx)
		if err != nil {
			if i == attempts-1 {
				return nil, err
			}
			logger.Error("Failed to ping DB", mlog.Float("retrying in seconds", DBConnRetrySleep.Seconds()), mlog.Err(err))
			time.Sleep(DBConnRetrySleep)
			continue
		}
		break
	}

	if strings.HasPrefix(connType, replicaLagPrefix) {
		// If this is a replica lag connection, we just open one connection.
		//
		// Arguably, if the query doesn't require a special credential, it does take up
		// one extra connection from the replica DB. But falling back to the replica
		// data source when the replica lag data source is null implies an ordering constraint
		// which makes things brittle and is not a good design.
		// If connections are an overhead, it is advised to use a connection pool.
		db.SetMaxOpenConns(1)
		db.SetMaxIdleConns(1)
	} else {
		db.SetMaxIdleConns(*settings.MaxIdleConns)
		db.SetMaxOpenConns(*settings.MaxOpenConns)
	}
	db.SetConnMaxLifetime(time.Duration(*settings.ConnMaxLifetimeMilliseconds) * time.Millisecond)
	db.SetConnMaxIdleTime(time.Duration(*settings.ConnMaxIdleTimeMilliseconds) * time.Millisecond)

	return db, nil
}

func SanitizeDataSource(driverName, dataSource string) (string, error) {
	switch driverName {
	case model.DatabaseDriverPostgres:
		u, err := url.Parse(dataSource)
		if err != nil {
			return "", err
		}
		u.User = url.UserPassword("****", "****")
		params := u.Query()
		params.Del("user")
		params.Del("password")
		u.RawQuery = params.Encode()
		return u.String(), nil
	case model.DatabaseDriverMysql:
		cfg, err := mysql.ParseDSN(dataSource)
		if err != nil {
			return "", err
		}
		cfg.User = "****"
		cfg.Passwd = "****"
		return cfg.FormatDSN(), nil
	default:
		return "", errors.New("invalid drivername. Not postgres or mysql.")
	}
}
