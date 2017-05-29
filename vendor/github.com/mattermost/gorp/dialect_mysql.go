// Copyright 2012 James Cooper. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

// Package gorp provides a simple way to marshal Go structs to and from
// SQL databases.  It uses the database/sql package, and should work with any
// compliant database/sql driver.
//
// Source code and project home:
// https://github.com/go-gorp/gorp

package gorp

import (
	"fmt"
	"reflect"
	"strings"
)

// Implementation of Dialect for MySQL databases.
type MySQLDialect struct {

	// Engine is the storage engine to use "InnoDB" vs "MyISAM" for example
	Engine string

	// Encoding is the character encoding to use for created tables
	Encoding string
}

func (d MySQLDialect) Name() string { return "MySQLDialect" }

func (d MySQLDialect) QuerySuffix() string { return ";" }

func (d MySQLDialect) ToSqlType(val reflect.Type, maxsize int, isAutoIncr bool) string {
	switch val.Kind() {
	case reflect.Ptr:
		return d.ToSqlType(val.Elem(), maxsize, isAutoIncr)
	case reflect.Bool:
		return "boolean"
	case reflect.Int8:
		return "tinyint"
	case reflect.Uint8:
		return "tinyint unsigned"
	case reflect.Int16:
		return "smallint"
	case reflect.Uint16:
		return "smallint unsigned"
	case reflect.Int, reflect.Int32:
		return "int"
	case reflect.Uint, reflect.Uint32:
		return "int unsigned"
	case reflect.Int64:
		return "bigint"
	case reflect.Uint64:
		return "bigint unsigned"
	case reflect.Float64, reflect.Float32:
		return "double"
	case reflect.Slice:
		if val.Elem().Kind() == reflect.Uint8 {
			return "mediumblob"
		}
	}

	switch val.Name() {
	case "NullInt64":
		return "bigint"
	case "NullFloat64":
		return "double"
	case "NullBool":
		return "tinyint"
	case "Time":
		return "datetime"
	}

	if maxsize < 1 {
		maxsize = 255
	}

	/* == About varchar(N) ==
	 * N is number of characters.
	 * A varchar column can store up to 65535 bytes.
	 * Remember that 1 character is 3 bytes in utf-8 charset.
	 * Also remember that each row can store up to 65535 bytes,
	 * and you have some overheads, so it's not possible for a
	 * varchar column to have 65535/3 characters really.
	 * So it would be better to use 'text' type in stead of
	 * large varchar type.
	 */
	if maxsize < 256 {
		return fmt.Sprintf("varchar(%d)", maxsize)
	} else {
		return "text"
	}
}

// Returns auto_increment
func (d MySQLDialect) AutoIncrStr() string {
	return "auto_increment"
}

func (d MySQLDialect) AutoIncrBindValue() string {
	return "null"
}

func (d MySQLDialect) AutoIncrInsertSuffix(col *ColumnMap) string {
	return ""
}

// Returns engine=%s charset=%s  based on values stored on struct
func (d MySQLDialect) CreateTableSuffix() string {
	if d.Engine == "" || d.Encoding == "" {
		msg := "gorp - undefined"

		if d.Engine == "" {
			msg += " MySQLDialect.Engine"
		}
		if d.Engine == "" && d.Encoding == "" {
			msg += ","
		}
		if d.Encoding == "" {
			msg += " MySQLDialect.Encoding"
		}
		msg += ". Check that your MySQLDialect was correctly initialized when declared."
		panic(msg)
	}

	return fmt.Sprintf(" engine=%s charset=%s", d.Engine, d.Encoding)
}

func (m MySQLDialect) CreateIndexSuffix() string {
	return "using"
}

func (m MySQLDialect) DropIndexSuffix() string {
	return "on"
}

func (m MySQLDialect) TruncateClause() string {
	return "truncate"
}

// Returns "?"
func (d MySQLDialect) BindVar(i int) string {
	return "?"
}

func (d MySQLDialect) InsertAutoIncr(exec SqlExecutor, insertSql string, params ...interface{}) (int64, error) {
	return standardInsertAutoIncr(exec, insertSql, params...)
}

func (d MySQLDialect) QuoteField(f string) string {
	return "`" + f + "`"
}

func (d MySQLDialect) QuotedTableForQuery(schema string, table string) string {
	if strings.TrimSpace(schema) == "" {
		return d.QuoteField(table)
	}

	return schema + "." + d.QuoteField(table)
}

func (d MySQLDialect) IfSchemaNotExists(command, schema string) string {
	return fmt.Sprintf("%s if not exists", command)
}

func (d MySQLDialect) IfTableExists(command, schema, table string) string {
	return fmt.Sprintf("%s if exists", command)
}

func (d MySQLDialect) IfTableNotExists(command, schema, table string) string {
	return fmt.Sprintf("%s if not exists", command)
}
