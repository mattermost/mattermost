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

// Implementation of Dialect for Oracle databases.
type OracleDialect struct{}

func (d OracleDialect) Name() string { return "OracleDialect" }

func (d OracleDialect) QuerySuffix() string { return "" }

func (d OracleDialect) CreateIndexSuffix() string { return "" }

func (d OracleDialect) DropIndexSuffix() string { return "" }

func (d OracleDialect) ToSqlType(val reflect.Type, maxsize int, isAutoIncr bool) string {
	switch val.Kind() {
	case reflect.Ptr:
		return d.ToSqlType(val.Elem(), maxsize, isAutoIncr)
	case reflect.Bool:
		return "boolean"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32:
		if isAutoIncr {
			return "serial"
		}
		return "integer"
	case reflect.Int64, reflect.Uint64:
		if isAutoIncr {
			return "bigserial"
		}
		return "bigint"
	case reflect.Float64:
		return "double precision"
	case reflect.Float32:
		return "real"
	case reflect.Slice:
		if val.Elem().Kind() == reflect.Uint8 {
			return "bytea"
		}
	}

	switch val.Name() {
	case "NullInt64":
		return "bigint"
	case "NullFloat64":
		return "double precision"
	case "NullBool":
		return "boolean"
	case "NullTime", "Time":
		return "timestamp with time zone"
	}

	if maxsize > 0 {
		return fmt.Sprintf("varchar(%d)", maxsize)
	} else {
		return "text"
	}

}

// Returns empty string
func (d OracleDialect) AutoIncrStr() string {
	return ""
}

func (d OracleDialect) AutoIncrBindValue() string {
	return "NULL"
}

func (d OracleDialect) AutoIncrInsertSuffix(col *ColumnMap) string {
	return ""
}

// Returns suffix
func (d OracleDialect) CreateTableSuffix() string {
	return ""
}

func (d OracleDialect) TruncateClause() string {
	return "truncate"
}

// Returns "$(i+1)"
func (d OracleDialect) BindVar(i int) string {
	return fmt.Sprintf(":%d", i+1)
}

// After executing the insert uses the ColMap IdQuery to get the generated id
func (d OracleDialect) InsertQueryToTarget(exec SqlExecutor, insertSql, idSql string, target interface{}, params ...interface{}) error {
	_, err := exec.Exec(insertSql, params...)
	if err != nil {
		return err
	}
	id, err := exec.SelectInt(idSql)
	if err != nil {
		return err
	}
	switch target.(type) {
	case *int64:
		*(target.(*int64)) = id
	case *int32:
		*(target.(*int32)) = int32(id)
	case int:
		*(target.(*int)) = int(id)
	default:
		return fmt.Errorf("Id field can be int, int32 or int64")
	}
	return nil
}

func (d OracleDialect) QuoteField(f string) string {
	return `"` + strings.ToUpper(f) + `"`
}

func (d OracleDialect) QuotedTableForQuery(schema string, table string) string {
	if strings.TrimSpace(schema) == "" {
		return d.QuoteField(table)
	}

	return schema + "." + d.QuoteField(table)
}

func (d OracleDialect) IfSchemaNotExists(command, schema string) string {
	return fmt.Sprintf("%s if not exists", command)
}

func (d OracleDialect) IfTableExists(command, schema, table string) string {
	return fmt.Sprintf("%s if exists", command)
}

func (d OracleDialect) IfTableNotExists(command, schema, table string) string {
	return fmt.Sprintf("%s if not exists", command)
}
