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

// ColumnMap represents a mapping between a Go struct field and a single
// column in a table.
// Unique and MaxSize only inform the
// CreateTables() function and are not used by Insert/Update/Delete/Get.
type ColumnMap struct {
	// Column name in db table
	ColumnName string

	// If true, this column is skipped in generated SQL statements
	Transient bool

	// If true, " unique" is added to create table statements.
	// Not used elsewhere
	Unique bool

	// Query used for getting generated id after insert
	GeneratedIdQuery string

	// Passed to Dialect.ToSqlType() to assist in informing the
	// correct column type to map to in CreateTables()
	MaxSize int

	DefaultValue string

	fieldName  string
	gotype     reflect.Type
	isPK       bool
	isAutoIncr bool
	isNotNull  bool
}

// Rename allows you to specify the column name in the table
//
// Example:  table.ColMap("Updated").Rename("date_updated")
//
func (c *ColumnMap) Rename(colname string) *ColumnMap {
	c.ColumnName = colname
	return c
}

// SetTransient allows you to mark the column as transient. If true
// this column will be skipped when SQL statements are generated
func (c *ColumnMap) SetTransient(b bool) *ColumnMap {
	c.Transient = b
	return c
}

// SetUnique adds "unique" to the create table statements for this
// column, if b is true.
func (c *ColumnMap) SetUnique(b bool) *ColumnMap {
	c.Unique = b
	return c
}

// SetNotNull adds "not null" to the create table statements for this
// column, if nn is true.
func (c *ColumnMap) SetNotNull(nn bool) *ColumnMap {
	c.isNotNull = nn
	return c
}

// SetMaxSize specifies the max length of values of this column. This is
// passed to the dialect.ToSqlType() function, which can use the value
// to alter the generated type for "create table" statements
func (c *ColumnMap) SetMaxSize(size int) *ColumnMap {
	c.MaxSize = size
	return c
}
