// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

// Mock squirrel builder types
type SelectBuilder struct{}
type InsertBuilder struct{}
type UpdateBuilder struct{}

func (s SelectBuilder) Where(pred interface{}, args ...interface{}) SelectBuilder { return s }
func (s InsertBuilder) Values(values ...interface{}) InsertBuilder                { return s }
func (s UpdateBuilder) Set(column string, value interface{}) UpdateBuilder        { return s }

func Select(columns ...string) SelectBuilder { return SelectBuilder{} }
func Insert(into string) InsertBuilder       { return InsertBuilder{} }
func Update(table string) UpdateBuilder      { return UpdateBuilder{} }

// Valid: Using squirrel builder
func validUsingSquirrel() {
	// Valid: Using the squirrel builder for SELECT
	query := Select("*").Where("id = ?", 123)
	_ = query

	// Valid: Using the squirrel builder for INSERT
	insert := Insert("users").Values("john", 30)
	_ = insert

	// Valid: Using the squirrel builder for UPDATE
	update := Update("users").Set("name", "jane")
	_ = update

	// Valid: SQL keywords in comments
	// SELECT * FROM users WHERE id = 1

	// Valid: SQL keywords in variable names
	selectAll := true
	insertMode := false
	updateFlag := true
	_ = selectAll
	_ = insertMode
	_ = updateFlag
}

// Invalid: Raw SQL queries
func invalidRawSQLQueries() {
	// Invalid: Raw SELECT query
	query1 := "SELECT * FROM users WHERE id = ?" // want "Found leading \"select\" in a string"

	// Invalid: Raw SELECT with different case
	query2 := "Select name FROM users" // want "Found leading \"select\" in a string"

	// Invalid: Raw SELECT all caps
	query3 := "SELECT id, name FROM users" // want "Found leading \"select\" in a string"

	// Invalid: Raw INSERT query
	query4 := "INSERT INTO users (name, age) VALUES (?, ?)" // want "Found leading \"insert\" in a string"

	// Invalid: Raw INSERT with different case
	query5 := "Insert INTO users VALUES (?)" // want "Found leading \"insert\" in a string"

	// Invalid: Raw UPDATE query
	query6 := "UPDATE users SET name = ? WHERE id = ?" // want "Found leading \"update\" in a string"

	// Invalid: Raw UPDATE with different case
	query7 := "Update users SET status = 'active'" // want "Found leading \"update\" in a string"

	// Invalid: Multi-line raw SQL
	query8 := /* want "Found leading \"select\" in a string" */ `SELECT
		id,
		name,
		email
	FROM users`

	_ = query1
	_ = query2
	_ = query3
	_ = query4
	_ = query5
	_ = query6
	_ = query7
	_ = query8
}

// Valid: Non-SQL strings
func validNonSQLStrings() {
	// These should not trigger warnings - strings that don't start with SQL keywords
	msg1 := "Please choose your favorite color"
	msg2 := "Put the key into the lock"
	msg3 := "Change your profile settings"
	msg4 := "The button is blue"

	_ = msg1
	_ = msg2
	_ = msg3
	_ = msg4
}

// Invalid: SQL in function calls
func invalidSQLInFunctionCalls() {
	executeQuery("SELECT * FROM posts")          // want "Found leading \"select\" in a string"
	executeQuery("INSERT INTO posts VALUES (?)") // want "Found leading \"insert\" in a string"
	executeQuery("UPDATE posts SET content = ?") // want "Found leading \"update\" in a string"
}

func executeQuery(query string) {
	_ = query
}

// Valid: Empty strings and non-SQL content
func validEdgeCases() {
	empty := ""
	whitespace := "   "
	notSQL := "This is not SQL"
	deleteSQL := "DELETE FROM users" // DELETE is not checked

	_ = empty
	_ = whitespace
	_ = notSQL
	_ = deleteSQL
}
