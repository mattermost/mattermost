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

// IndexMap represents a mapping between a Go struct field and a single
// index in a table.
// Unique and MaxSize only inform the
// CreateTables() function and are not used by Insert/Update/Delete/Get.
type IndexMap struct {
	// Index name in db table
	IndexName string

	// If true, " unique" is added to create index statements.
	// Not used elsewhere
	Unique bool

	// Index type supported by Dialect
	// Postgres:  B-tree, Hash, GiST and GIN.
	// Mysql: Btree, Hash.
	// Sqlite: nil.
	IndexType string

	// Columns name for single and multiple indexes
	columns []string
}

// Rename allows you to specify the index name in the table
//
// Example:  table.IndMap("customer_test_idx").Rename("customer_idx")
//
func (idx *IndexMap) Rename(indname string) *IndexMap {
	idx.IndexName = indname
	return idx
}

// SetUnique adds "unique" to the create index statements for this
// index, if b is true.
func (idx *IndexMap) SetUnique(b bool) *IndexMap {
	idx.Unique = b
	return idx
}

// SetIndexType specifies the index type supported by chousen SQL Dialect
func (idx *IndexMap) SetIndexType(indtype string) *IndexMap {
	idx.IndexType = indtype
	return idx
}
