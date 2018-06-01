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
	"bytes"
	"fmt"
	"reflect"
	"strings"
)

// TableMap represents a mapping between a Go struct and a database table
// Use dbmap.AddTable() or dbmap.AddTableWithName() to create these
type TableMap struct {
	// Name of database table.
	TableName      string
	SchemaName     string
	gotype         reflect.Type
	Columns        []*ColumnMap
	keys           []*ColumnMap
	indexes        []*IndexMap
	uniqueTogether [][]string
	version        *ColumnMap
	insertPlan     bindPlan
	updatePlan     bindPlan
	deletePlan     bindPlan
	getPlan        bindPlan
	dbmap          *DbMap
}

// ResetSql removes cached insert/update/select/delete SQL strings
// associated with this TableMap.  Call this if you've modified
// any column names or the table name itself.
func (t *TableMap) ResetSql() {
	t.insertPlan = bindPlan{}
	t.updatePlan = bindPlan{}
	t.deletePlan = bindPlan{}
	t.getPlan = bindPlan{}
}

// SetKeys lets you specify the fields on a struct that map to primary
// key columns on the table.  If isAutoIncr is set, result.LastInsertId()
// will be used after INSERT to bind the generated id to the Go struct.
//
// Automatically calls ResetSql() to ensure SQL statements are regenerated.
//
// Panics if isAutoIncr is true, and fieldNames length != 1
//
func (t *TableMap) SetKeys(isAutoIncr bool, fieldNames ...string) *TableMap {
	if isAutoIncr && len(fieldNames) != 1 {
		panic(fmt.Sprintf(
			"gorp: SetKeys: fieldNames length must be 1 if key is auto-increment. (Saw %v fieldNames)",
			len(fieldNames)))
	}
	t.keys = make([]*ColumnMap, 0)
	for _, name := range fieldNames {
		colmap := t.ColMap(name)
		colmap.isPK = true
		colmap.isAutoIncr = isAutoIncr
		t.keys = append(t.keys, colmap)
	}
	t.ResetSql()

	return t
}

// SetUniqueTogether lets you specify uniqueness constraints across multiple
// columns on the table. Each call adds an additional constraint for the
// specified columns.
//
// Automatically calls ResetSql() to ensure SQL statements are regenerated.
//
// Panics if fieldNames length < 2.
//
func (t *TableMap) SetUniqueTogether(fieldNames ...string) *TableMap {
	if len(fieldNames) < 2 {
		panic(fmt.Sprintf(
			"gorp: SetUniqueTogether: must provide at least two fieldNames to set uniqueness constraint."))
	}

	columns := make([]string, 0, len(fieldNames))
	for _, name := range fieldNames {
		columns = append(columns, name)
	}

	alreadyExists := false
checkDuplicates:
	for _, existingColumns := range t.uniqueTogether {
		if len(existingColumns) == len(columns) {
			for i := range columns {
				if existingColumns[i] != columns[i] {
					continue checkDuplicates
				}
			}

			alreadyExists = true
			break checkDuplicates
		}
	}
	if !alreadyExists {
		t.uniqueTogether = append(t.uniqueTogether, columns)
		t.ResetSql()
	}

	return t
}

// ColMap returns the ColumnMap pointer matching the given struct field
// name.  It panics if the struct does not contain a field matching this
// name.
func (t *TableMap) ColMap(field string) *ColumnMap {
	col := colMapOrNil(t, field)
	if col == nil {
		e := fmt.Sprintf("No ColumnMap in table %s type %s with field %s",
			t.TableName, t.gotype.Name(), field)

		panic(e)
	}
	return col
}

func colMapOrNil(t *TableMap, field string) *ColumnMap {
	for _, col := range t.Columns {
		if col.fieldName == field || col.ColumnName == field {
			return col
		}
	}
	return nil
}

// IdxMap returns the IndexMap pointer matching the given index name.
func (t *TableMap) IdxMap(field string) *IndexMap {
	for _, idx := range t.indexes {
		if idx.IndexName == field {
			return idx
		}
	}
	return nil
}

// AddIndex registers the index with gorp for specified table with given parameters.
// This operation is idempotent. If index is already mapped, the
// existing *IndexMap is returned
// Function will panic if one of the given for index columns does not exists
//
// Automatically calls ResetSql() to ensure SQL statements are regenerated.
//
func (t *TableMap) AddIndex(name string, idxtype string, columns []string) *IndexMap {
	// check if we have a index with this name already
	for _, idx := range t.indexes {
		if idx.IndexName == name {
			return idx
		}
	}
	for _, icol := range columns {
		if res := t.ColMap(icol); res == nil {
			e := fmt.Sprintf("No ColumnName in table %s to create index on", t.TableName)
			panic(e)
		}
	}

	idx := &IndexMap{IndexName: name, Unique: false, IndexType: idxtype, columns: columns}
	t.indexes = append(t.indexes, idx)
	t.ResetSql()
	return idx
}

// SetVersionCol sets the column to use as the Version field.  By default
// the "Version" field is used.  Returns the column found, or panics
// if the struct does not contain a field matching this name.
//
// Automatically calls ResetSql() to ensure SQL statements are regenerated.
func (t *TableMap) SetVersionCol(field string) *ColumnMap {
	c := t.ColMap(field)
	t.version = c
	t.ResetSql()
	return c
}

// SqlForCreateTable gets a sequence of SQL commands that will create
// the specified table and any associated schema
func (t *TableMap) SqlForCreate(ifNotExists bool) string {
	s := bytes.Buffer{}
	dialect := t.dbmap.Dialect

	if strings.TrimSpace(t.SchemaName) != "" {
		schemaCreate := "create schema"
		if ifNotExists {
			s.WriteString(dialect.IfSchemaNotExists(schemaCreate, t.SchemaName))
		} else {
			s.WriteString(schemaCreate)
		}
		s.WriteString(fmt.Sprintf(" %s;", t.SchemaName))
	}

	tableCreate := "create table"
	if ifNotExists {
		s.WriteString(dialect.IfTableNotExists(tableCreate, t.SchemaName, t.TableName))
	} else {
		s.WriteString(tableCreate)
	}
	s.WriteString(fmt.Sprintf(" %s (", dialect.QuotedTableForQuery(t.SchemaName, t.TableName)))

	x := 0
	for _, col := range t.Columns {
		if !col.Transient {
			if x > 0 {
				s.WriteString(", ")
			}
			stype := dialect.ToSqlType(col.gotype, col.MaxSize, col.isAutoIncr)
			s.WriteString(fmt.Sprintf("%s %s", dialect.QuoteField(col.ColumnName), stype))

			if col.isPK || col.isNotNull {
				s.WriteString(" not null")
			}
			if col.isPK && len(t.keys) == 1 {
				s.WriteString(" primary key")
			}
			if col.Unique {
				s.WriteString(" unique")
			}
			if col.isAutoIncr {
				s.WriteString(fmt.Sprintf(" %s", dialect.AutoIncrStr()))
			}

			x++
		}
	}
	if len(t.keys) > 1 {
		s.WriteString(", primary key (")
		for x := range t.keys {
			if x > 0 {
				s.WriteString(", ")
			}
			s.WriteString(dialect.QuoteField(t.keys[x].ColumnName))
		}
		s.WriteString(")")
	}
	if len(t.uniqueTogether) > 0 {
		for _, columns := range t.uniqueTogether {
			s.WriteString(", unique (")
			for i, column := range columns {
				if i > 0 {
					s.WriteString(", ")
				}
				s.WriteString(dialect.QuoteField(column))
			}
			s.WriteString(")")
		}
	}
	s.WriteString(") ")
	s.WriteString(dialect.CreateTableSuffix())
	s.WriteString(dialect.QuerySuffix())
	return s.String()
}
