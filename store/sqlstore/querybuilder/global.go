// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package querybuilder

// newQuery returns a new Query object.
func newQuery() *Query {
	return &Query{}
}

// Select creates a new Query, adding a SELECT expression to the resulting query.
func Select(sql string) *Query {
	return newQuery().Select(sql)
}

// From creates a new Query, adding a FROM expression to the resulting query.
func From(sql string) *Query {
	return newQuery().From(sql)
}

// Join creates a new Query, adding an INNER JOIN expression to the resulting query.
func Join(sql string) *Query {
	return newQuery().Join(sql)
}

// LeftJoin creates a new Query, adding a LEFT JOIN expression to the resulting query.
func LeftJoin(sql string) *Query {
	return newQuery().LeftJoin(sql)
}

// RightJoin creates a new Query, adding a RIGHT JOIN expression to the resulting query.
func RightJoin(sql string) *Query {
	return newQuery().RightJoin(sql)
}

// Where creates a new Query, adding a WHERE expression to the resulting query.
func Where(sql string) *Query {
	return newQuery().Where(sql)
}

// OrderBy creates a new Query, adding an ORDER BY expression to the resulting query.
func OrderBy(sql string) *Query {
	return newQuery().OrderBy(sql)
}

// Offset creates a new Query, adding an OFFSET expression to the resulting query.
// The given integer parameter is added to the set of arguments for use with the final query.
func Offset(offset int) *Query {
	return newQuery().Offset(offset)
}

// Limit creates a new Query, adding a LIMIT expression to the resulting query.
// The given integer parameter is added to the set of arguments for use with the final query.
func Limit(limit int) *Query {
	return newQuery().Limit(limit)
}

// Bind creates a new Query, adding or replacing the given key and value as an argument to the
// resulting query.
// String and integer values are supported, and will be exploded automatically into a list of
// arguments.
func Bind(key string, value interface{}) *Query {
	return newQuery().Bind(key, value)
}
