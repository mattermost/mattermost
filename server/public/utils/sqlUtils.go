// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import "github.com/go-sql-driver/mysql"

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
