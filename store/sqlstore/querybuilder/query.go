// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package querybuilder

import (
	"fmt"
	"reflect"
	"regexp"
	"strconv"
	"strings"
)

var argRe = regexp.MustCompile(`\B:[a-zA-Z_]+\b`)

// Query builds dynamic SQL queries using a fluent and immutable interface.
// At its core, it is nothing more than a SQL-aware string concatenation library. It is not an ORM.
//
// Unlike similar libraries, it doesn't integrate with database/sql directly, doesn't read and
// populate model structs, and generally doesn't try to expose more of an API than needed. Feel
// free to pass in entire SQL statements as necessary, but realize that this library won't try to
// parse or validate the resulting SQL. Garbage in: garbage out.
//
// It doesn't currently support INSERT, UPDATE or DELETE statements, but this would be a trivial
// addition.
type Query struct {
	selectStatements  []string
	fromStatements    []string
	joinStatements    []string
	whereStatements   []string
	orderByStatements []string
	offset            string
	limit             string
	args              map[string]interface{}
}

// clone duplicates the query object, enabling immutability in the exposed API.
// Arrays and maps in the cloned query object are shallow copied here, and deep copied only when
// modified.
func (q *Query) clone() *Query {
	clone := &Query{
		selectStatements:  q.selectStatements,
		fromStatements:    q.fromStatements,
		joinStatements:    q.joinStatements,
		whereStatements:   q.whereStatements,
		orderByStatements: q.orderByStatements,
		offset:            q.offset,
		limit:             q.limit,
		args:              q.args,
	}

	return clone
}

// Select clones the query object, adding a SELECT expression to the resulting query.
func (q *Query) Select(sql string) *Query {
	clone := q.clone()

	clone.selectStatements = make([]string, len(q.selectStatements)+1)
	copy(clone.selectStatements, q.selectStatements)
	clone.selectStatements[len(q.selectStatements)] = sql

	return clone
}

// From clones the query object, adding a FROM expression to the resulting query.
func (q *Query) From(sql string) *Query {
	clone := q.clone()

	clone.fromStatements = make([]string, len(q.fromStatements)+1)
	copy(clone.fromStatements, q.fromStatements)
	clone.fromStatements[len(q.fromStatements)] = sql

	return clone
}

// Join clones the query object, adding an INNER JOIN expression to the resulting query.
func (q *Query) Join(sql string) *Query {
	clone := q.clone()

	clone.joinStatements = make([]string, len(q.joinStatements)+1)
	copy(clone.joinStatements, q.joinStatements)
	clone.joinStatements[len(q.joinStatements)] = "INNER JOIN " + sql

	return clone
}

// LeftJoin clones the query object, adding a LEFT JOIN expression to the resulting query.
func (q *Query) LeftJoin(sql string) *Query {
	clone := q.clone()

	clone.joinStatements = make([]string, len(q.joinStatements)+1)
	copy(clone.joinStatements, q.joinStatements)
	clone.joinStatements[len(q.joinStatements)] = "LEFT JOIN " + sql

	return clone
}

// RightJoin clones the query object, adding a RIGHT JOIN expression to the resulting query.
func (q *Query) RightJoin(sql string) *Query {
	clone := q.clone()

	clone.joinStatements = make([]string, len(q.joinStatements)+1)
	copy(clone.joinStatements, q.joinStatements)
	clone.joinStatements[len(q.joinStatements)] = "RIGHT JOIN " + sql

	return clone
}

// Where clones the query object, adding a WHERE expression to the resulting query.
func (q *Query) Where(sql string) *Query {
	clone := q.clone()

	clone.whereStatements = make([]string, len(q.whereStatements)+1)
	copy(clone.whereStatements, q.whereStatements)
	clone.whereStatements[len(q.whereStatements)] = sql

	return clone
}

// OrderBy clones the query object, adding an ORDER BY expression to the resulting query.
func (q *Query) OrderBy(sql string) *Query {
	clone := q.clone()

	clone.orderByStatements = make([]string, len(q.orderByStatements)+1)
	copy(clone.orderByStatements, q.orderByStatements)
	clone.orderByStatements[len(q.orderByStatements)] = sql

	return clone
}

// Offset clones the query object, adding an OFFSET expression to the resulting query.
// The given integer parameter is added to the set of arguments for use with the final query.
func (q *Query) Offset(offset int) *Query {
	clone := q.clone()
	clone.offset = strconv.Itoa(offset)

	return clone
}

// Limit clones the query object, adding a LIMIT expression to the resulting query.
// The given integer parameter is added to the set of arguments for use with the final query.
func (q *Query) Limit(limit int) *Query {
	clone := q.clone()
	clone.limit = strconv.Itoa(limit)

	return clone
}

// Bind clones the query object, adding or replacing the given key and value as an argument to the
// resulting query.
// String and integer values are supported, and will be exploded automatically into a list of
// arguments.
func (q *Query) Bind(key string, value interface{}) *Query {
	// It's a natural mistake to write the key prefixed with the colon: fix that and move on.
	key = strings.TrimLeft(key, ":")

	clone := q.clone()
	clone.args = make(map[string]interface{})
	for k, v := range q.args {
		clone.args[k] = v
	}
	clone.args[key] = value

	return clone
}

// String generates the final query for execution.
func (q *Query) String() string {
	var query string

	if len(q.selectStatements) > 0 {
		query += "SELECT " + strings.Join(q.selectStatements, ", ")
	}
	if len(q.fromStatements) > 0 {
		query += " FROM " + strings.Join(q.fromStatements, ", ")
	}
	if len(q.joinStatements) > 0 {
		query += " " + strings.Join(q.joinStatements, " ")
	}
	if len(q.whereStatements) > 0 {
		query += " WHERE " + strings.Join(q.whereStatements, " AND ")
	}
	if len(q.orderByStatements) > 0 {
		query += " ORDER BY " + strings.Join(q.orderByStatements, ", ")
	}
	if len(q.limit) > 0 {
		query += " LIMIT " + q.limit
	}
	if len(q.offset) > 0 {
		query += " OFFSET " + q.offset
	}

	// If an argument named :Ids is bound to an string or integer slice or array, explode in
	// place as :Ids_0, :Ids_1, ... :Ids_N.
	for key, value := range q.args {
		rt := reflect.TypeOf(value)
		switch rt.Kind() {
		case reflect.Slice:
			fallthrough
		case reflect.Array:
			switch rt.Elem().Kind() {
			case reflect.String:
				fallthrough
			case reflect.Int:
				valueLen := reflect.ValueOf(value).Len()

				var keys []string
				for index := 0; index < valueLen; index++ {
					keys = append(keys, fmt.Sprintf(":%s_%d", key, index))
				}

				query = argRe.ReplaceAllStringFunc(query, func(match string) string {
					if match != ":"+key {
						return match
					}

					return strings.Join(keys, ", ")
				})
			}
		}
	}

	return query
}

// Args shallow copies the argument map for use with the final query, exploding string and integer arrays as necessary.
func (q *Query) Args() map[string]interface{} {
	args := map[string]interface{}{}

	for key, value := range q.args {
		rt := reflect.TypeOf(value)
		switch rt.Kind() {
		case reflect.Slice:
			fallthrough
		case reflect.Array:
			switch rt.Elem().Kind() {
			case reflect.String:
				for index, v := range value.([]string) {
					args[fmt.Sprintf("%s_%d", key, index)] = v
				}

			case reflect.Int:
				for index, v := range value.([]int) {
					args[fmt.Sprintf("%s_%d", key, index)] = v
				}

			default:
				args[key] = value
			}
		default:
			args[key] = value
		}
	}

	return args
}
