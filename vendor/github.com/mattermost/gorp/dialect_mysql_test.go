// Copyright 2012 James Cooper. All rights reserved.
// Use of this source code is governed by a MIT-style
// license that can be found in the LICENSE file.

// Package gorp provides a simple way to marshal Go structs to and from
// SQL databases.  It uses the database/sql package, and should work with any
// compliant database/sql driver.
//
// Source code and project home:
// https://github.com/go-gorp/gorp

package gorp_test

import (
	"database/sql"
	"reflect"
	"time"

	// ginkgo/gomega functions read better as dot-imports.
	. "github.com/onsi/ginkgo"
	. "github.com/onsi/ginkgo/extensions/table"
	. "github.com/onsi/gomega"

	"github.com/go-gorp/gorp"
)

var _ = Describe("MySQLDialect", func() {
	var (
		engine, encoding string
		dialect          gorp.MySQLDialect
	)

	JustBeforeEach(func() {
		dialect = gorp.MySQLDialect{
			Engine:   engine,
			Encoding: encoding,
		}
	})

	DescribeTable("ToSqlType",
		func(value interface{}, maxsize int, autoIncr bool, expected string) {
			typ := reflect.TypeOf(value)
			sqlType := dialect.ToSqlType(typ, maxsize, autoIncr)
			Expect(sqlType).To(Equal(expected))
		},
		Entry("bool", true, 0, false, "boolean"),
		Entry("int8", int8(1), 0, false, "tinyint"),
		Entry("uint8", uint8(1), 0, false, "tinyint unsigned"),
		Entry("int16", int16(1), 0, false, "smallint"),
		Entry("uint16", uint16(1), 0, false, "smallint unsigned"),
		Entry("int32", int32(1), 0, false, "int"),
		Entry("int (treated as int32)", int(1), 0, false, "int"),
		Entry("uint32", uint32(1), 0, false, "int unsigned"),
		Entry("uint (treated as uint32)", uint(1), 0, false, "int unsigned"),
		Entry("int64", int64(1), 0, false, "bigint"),
		Entry("uint64", uint64(1), 0, false, "bigint unsigned"),
		Entry("float32", float32(1), 0, false, "double"),
		Entry("float64", float64(1), 0, false, "double"),
		Entry("[]uint8", []uint8{1}, 0, false, "mediumblob"),
		Entry("NullInt64", sql.NullInt64{}, 0, false, "bigint"),
		Entry("NullFloat64", sql.NullFloat64{}, 0, false, "double"),
		Entry("NullBool", sql.NullBool{}, 0, false, "tinyint"),
		Entry("Time", time.Time{}, 0, false, "datetime"),
		Entry("default-size string", "", 0, false, "varchar(255)"),
		Entry("sized string", "", 50, false, "varchar(50)"),
		Entry("large string", "", 1024, false, "text"),
	)

	Describe("AutoIncrStr", func() {
		It("returns the auto increment string", func() {
			Expect(dialect.AutoIncrStr()).To(Equal("auto_increment"))
		})
	})

	Describe("AutoIncrBindValue", func() {
		It("returns the value used to bind the auto-increment value", func() {
			Expect(dialect.AutoIncrBindValue()).To(Equal("null"))
		})
	})

	Describe("AutoIncrInsertSuffix", func() {
		It("returns the suffix needed for auto-incrementing", func() {
			Expect(dialect.AutoIncrInsertSuffix(nil)).To(BeEmpty())
		})
	})

	Describe("CreateTableSuffix", func() {
		Context("with an empty engine", func() {
			BeforeEach(func() {
				engine = ""
				encoding = "foo"
			})
			It("panics", func() {
				Expect(func() {
					dialect.CreateTableSuffix()
				}).To(Panic())
			})
		})

		Context("with an empty encoding", func() {
			BeforeEach(func() {
				engine = "foo"
				encoding = ""
			})
			It("panics", func() {
				Expect(func() {
					dialect.CreateTableSuffix()
				}).To(Panic())
			})
		})

		Context("with an engine and an encoding", func() {
			BeforeEach(func() {
				engine = "foo"
				encoding = "bar"
			})
			It("returns a valid suffix", func() {
				Expect(dialect.CreateTableSuffix()).To(Equal(" engine=foo charset=bar"))
			})
		})
	})

	Describe("CreateIndexSuffix", func() {
		It("returns the suffix for creating indexes", func() {
			Expect(dialect.CreateIndexSuffix()).To(Equal("using"))
		})
	})

	Describe("DropIndexSuffix", func() {
		It("returns the suffix for deleting indexes", func() {
			Expect(dialect.DropIndexSuffix()).To(Equal("on"))
		})
	})

	Describe("TruncateClause", func() {
		It("returns the clause for truncating a table", func() {
			Expect(dialect.TruncateClause()).To(Equal("truncate"))
		})
	})

	Describe("BindVar", func() {
		It("returns the variable binding sequence", func() {
			Expect(dialect.BindVar(0)).To(Equal("?"))
		})
	})

	PDescribe("InsertAutoIncr", func() {})

	Describe("QuoteField", func() {
		It("returns the argument quoted as a field", func() {
			Expect(dialect.QuoteField("foo")).To(Equal("`foo`"))
		})
	})

	Describe("QuotedTableForQuery", func() {
		var (
			schema, table string

			quotedTable string
		)

		JustBeforeEach(func() {
			quotedTable = dialect.QuotedTableForQuery(schema, table)
		})

		Context("using the default schema", func() {
			BeforeEach(func() {
				schema = ""
				table = "foo"
			})
			It("returns just the table", func() {
				Expect(quotedTable).To(Equal("`foo`"))
			})
		})

		Context("with a supplied schema", func() {
			BeforeEach(func() {
				schema = "foo"
				table = "bar"
			})
			It("returns the schema and table", func() {
				Expect(quotedTable).To(Equal("foo.`bar`"))
			})
		})
	})

	Describe("IfSchemaNotExists", func() {
		It("appends 'if not exists' to the command", func() {
			Expect(dialect.IfSchemaNotExists("foo", "bar")).To(Equal("foo if not exists"))
		})
	})

	Describe("IfTableExists", func() {
		It("appends 'if exists' to the command", func() {
			Expect(dialect.IfTableExists("foo", "bar", "baz")).To(Equal("foo if exists"))
		})
	})

	Describe("IfTableNotExists", func() {
		It("appends 'if not exists' to the command", func() {
			Expect(dialect.IfTableNotExists("foo", "bar", "baz")).To(Equal("foo if not exists"))
		})
	})
})
