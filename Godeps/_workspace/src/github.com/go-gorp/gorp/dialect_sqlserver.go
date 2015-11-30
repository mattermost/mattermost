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

// Implementation of Dialect for Microsoft SQL Server databases.
// Use gorp.SqlServerDialect{"2005"} for legacy datatypes.
// Tested with driver: github.com/denisenkom/go-mssqldb

type SqlServerDialect struct {

	// If set to "2005" legacy datatypes will be used
	Version string
}

func (d SqlServerDialect) ToSqlType(val reflect.Type, maxsize int, isAutoIncr bool) string {
	switch val.Kind() {
	case reflect.Ptr:
		return d.ToSqlType(val.Elem(), maxsize, isAutoIncr)
	case reflect.Bool:
		return "bit"
	case reflect.Int8:
		return "tinyint"
	case reflect.Uint8:
		return "smallint"
	case reflect.Int16:
		return "smallint"
	case reflect.Uint16:
		return "int"
	case reflect.Int, reflect.Int32:
		return "int"
	case reflect.Uint, reflect.Uint32:
		return "bigint"
	case reflect.Int64:
		return "bigint"
	case reflect.Uint64:
		return "numeric(20,0)"
	case reflect.Float32:
		return "float(24)"
	case reflect.Float64:
		return "float(53)"
	case reflect.Slice:
		if val.Elem().Kind() == reflect.Uint8 {
			return "varbinary"
		}
	}

	switch val.Name() {
	case "NullInt64":
		return "bigint"
	case "NullFloat64":
		return "float(53)"
	case "NullBool":
		return "bit"
	case "NullTime", "Time":
		if d.Version == "2005" {
			return "datetime"
		}
		return "datetime2"
	}

	if maxsize < 1 {
		if d.Version == "2005" {
			maxsize = 255
		} else {
			return fmt.Sprintf("nvarchar(max)")
		}
	}
	return fmt.Sprintf("nvarchar(%d)", maxsize)
}

// Returns auto_increment
func (d SqlServerDialect) AutoIncrStr() string {
	return "identity(0,1)"
}

// Empty string removes autoincrement columns from the INSERT statements.
func (d SqlServerDialect) AutoIncrBindValue() string {
	return ""
}

func (d SqlServerDialect) AutoIncrInsertSuffix(col *ColumnMap) string {
	return ""
}

func (d SqlServerDialect) CreateTableSuffix() string { return ";" }

func (d SqlServerDialect) TruncateClause() string {
	return "truncate table"
}

// Returns "?"
func (d SqlServerDialect) BindVar(i int) string {
	return "?"
}

func (d SqlServerDialect) InsertAutoIncr(exec SqlExecutor, insertSql string, params ...interface{}) (int64, error) {
	return standardInsertAutoIncr(exec, insertSql, params...)
}

func (d SqlServerDialect) QuoteField(f string) string {
	return "[" + strings.Replace(f, "]", "]]", -1) + "]"
}

func (d SqlServerDialect) QuotedTableForQuery(schema string, table string) string {
	if strings.TrimSpace(schema) == "" {
		return d.QuoteField(table)
	}
	return d.QuoteField(schema) + "." + d.QuoteField(table)
}

func (d SqlServerDialect) QuerySuffix() string { return ";" }

func (d SqlServerDialect) IfSchemaNotExists(command, schema string) string {
	s := fmt.Sprintf("if schema_id(N'%s') is null %s", schema, command)
	return s
}

func (d SqlServerDialect) IfTableExists(command, schema, table string) string {
	var schema_clause string
	if strings.TrimSpace(schema) != "" {
		schema_clause = fmt.Sprintf("%s.", d.QuoteField(schema))
	}
	s := fmt.Sprintf("if object_id('%s%s') is not null %s", schema_clause, d.QuoteField(table), command)
	return s
}

func (d SqlServerDialect) IfTableNotExists(command, schema, table string) string {
	var schema_clause string
	if strings.TrimSpace(schema) != "" {
		schema_clause = fmt.Sprintf("%s.", schema)
	}
	s := fmt.Sprintf("if object_id('%s%s') is null %s", schema_clause, table, command)
	return s
}

func (d SqlServerDialect) CreateIndexSuffix() string { return "" }
func (d SqlServerDialect) DropIndexSuffix() string   { return "" }
