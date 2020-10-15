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

import "reflect"

// The Dialect interface encapsulates behaviors that differ across
// SQL databases.  At present the Dialect is only used by CreateTables()
// but this could change in the future
type Dialect interface {

	// dialect name
	Name() string

	// adds a suffix to any query, usually ";"
	QuerySuffix() string

	// ToSqlType returns the SQL column type to use when creating a
	// table of the given Go Type.  maxsize can be used to switch based on
	// size.  For example, in MySQL []byte could map to BLOB, MEDIUMBLOB,
	// or LONGBLOB depending on the maxsize
	ToSqlType(val reflect.Type, maxsize int, isAutoIncr bool) string

	// string to append to primary key column definitions
	AutoIncrStr() string

	// string to bind autoincrement columns to. Empty string will
	// remove reference to those columns in the INSERT statement.
	AutoIncrBindValue() string

	AutoIncrInsertSuffix(col *ColumnMap) string

	// string to append to "create table" statement for vendor specific
	// table attributes
	CreateTableSuffix() string

	// string to append to "create index" statement
	CreateIndexSuffix() string

	// string to append to "drop index" statement
	DropIndexSuffix() string

	// string to truncate tables
	TruncateClause() string

	// bind variable string to use when forming SQL statements
	// in many dbs it is "?", but Postgres appears to use $1
	//
	// i is a zero based index of the bind variable in this statement
	//
	BindVar(i int) string

	// Handles quoting of a field name to ensure that it doesn't raise any
	// SQL parsing exceptions by using a reserved word as a field name.
	QuoteField(field string) string

	// Handles building up of a schema.database string that is compatible with
	// the given dialect
	//
	// schema - The schema that <table> lives in
	// table - The table name
	QuotedTableForQuery(schema string, table string) string

	// Existance clause for table creation / deletion
	IfSchemaNotExists(command, schema string) string
	IfTableExists(command, schema, table string) string
	IfTableNotExists(command, schema, table string) string
}

// IntegerAutoIncrInserter is implemented by dialects that can perform
// inserts with automatically incremented integer primary keys.  If
// the dialect can handle automatic assignment of more than just
// integers, see TargetedAutoIncrInserter.
type IntegerAutoIncrInserter interface {
	InsertAutoIncr(exec SqlExecutor, insertSql string, params ...interface{}) (int64, error)
}

// TargetedAutoIncrInserter is implemented by dialects that can
// perform automatic assignment of any primary key type (i.e. strings
// for uuids, integers for serials, etc).
type TargetedAutoIncrInserter interface {
	// InsertAutoIncrToTarget runs an insert operation and assigns the
	// automatically generated primary key directly to the passed in
	// target.  The target should be a pointer to the primary key
	// field of the value being inserted.
	InsertAutoIncrToTarget(exec SqlExecutor, insertSql string, target interface{}, params ...interface{}) error
}

// TargetQueryInserter is implemented by dialects that can perform
// assignment of integer primary key type by executing a query
// like "select sequence.currval from dual".
type TargetQueryInserter interface {
	// TargetQueryInserter runs an insert operation and assigns the
	// automatically generated primary key retrived by the query
	// extracted from the GeneratedIdQuery field of the id column.
	InsertQueryToTarget(exec SqlExecutor, insertSql, idSql string, target interface{}, params ...interface{}) error
}

func standardInsertAutoIncr(exec SqlExecutor, insertSql string, params ...interface{}) (int64, error) {
	res, err := exec.Exec(insertSql, params...)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}
