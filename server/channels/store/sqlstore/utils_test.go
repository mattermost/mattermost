// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"testing"

	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMapStringsToQueryParams(t *testing.T) {
	t.Run("one item", func(t *testing.T) {
		input := []string{"apple"}

		keys, params := MapStringsToQueryParams(input, "Fruit")

		require.Len(t, params, 1, "returned incorrect params", params)
		require.Equal(t, "apple", params["Fruit0"], "returned incorrect params", params)
		require.Equal(t, "(:Fruit0)", keys, "returned incorrect query", keys)
	})

	t.Run("multiple items", func(t *testing.T) {
		input := []string{"carrot", "tomato", "potato"}

		keys, params := MapStringsToQueryParams(input, "Vegetable")

		require.Len(t, params, 3, "returned incorrect params", params)
		require.Equal(t, "carrot", params["Vegetable0"], "returned incorrect params", params)
		require.Equal(t, "tomato", params["Vegetable1"], "returned incorrect params", params)
		require.Equal(t, "potato", params["Vegetable2"], "returned incorrect params", params)
		require.Equal(t, "(:Vegetable0,:Vegetable1,:Vegetable2)", keys, "returned incorrect query", keys)
	})
}

var keys string
var params map[string]any

func BenchmarkMapStringsToQueryParams(b *testing.B) {
	b.Run("one item", func(b *testing.B) {
		input := []string{"apple"}
		for i := 0; i < b.N; i++ {
			keys, params = MapStringsToQueryParams(input, "Fruit")
		}
	})
	b.Run("multiple items", func(b *testing.B) {
		input := []string{"carrot", "tomato", "potato"}
		for i := 0; i < b.N; i++ {
			keys, params = MapStringsToQueryParams(input, "Vegetable")
		}
	})
}

func TestSanitizeSearchTerm(t *testing.T) {
	term := "test"
	result := sanitizeSearchTerm(term, "\\")
	require.Equal(t, result, term)

	term = "%%%"
	expected := "\\%\\%\\%"
	result = sanitizeSearchTerm(term, "\\")
	require.Equal(t, result, expected)

	term = "%\\%\\%"
	expected = "\\%\\%\\%"
	result = sanitizeSearchTerm(term, "\\")
	require.Equal(t, result, expected)

	term = "%_test_%"
	expected = "\\%\\_test\\_\\%"
	result = sanitizeSearchTerm(term, "\\")
	require.Equal(t, result, expected)

	term = "**test_%"
	expected = "test*_*%"
	result = sanitizeSearchTerm(term, "*")
	require.Equal(t, result, expected)
}

func TestRemoveNonAlphaNumericUnquotedTerms(t *testing.T) {
	const (
		sep           = " "
		chineseHello  = "你好"
		japaneseHello = "こんにちは"
	)
	tests := []struct {
		term string
		want string
		name string
	}{
		{term: "", want: "", name: "empty"},
		{term: "h", want: "h", name: "singleChar"},
		{term: "hello", want: "hello", name: "multiChar"},
		{term: `hel*lo "**" **& hello`, want: `hel*lo "**" hello`, name: "quoted_unquoted_english"},
		{term: japaneseHello + chineseHello, want: japaneseHello + chineseHello, name: "japanese_chinese"},
		{term: japaneseHello + ` "*" ` + chineseHello, want: japaneseHello + ` "*" ` + chineseHello, name: `quoted_japanese_and_chinese`},
		{term: japaneseHello + ` "*" &&* ` + chineseHello, want: japaneseHello + ` "*" ` + chineseHello, name: "quoted_unquoted_japanese_and_chinese"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got := removeNonAlphaNumericUnquotedTerms(test.term, sep)
			require.Equal(t, test.want, got)
		})
	}
}

func TestMySQLJSONArgs(t *testing.T) {
	tests := []struct {
		props     map[string]string
		args      []any
		argString string
	}{
		{
			props: map[string]string{
				"desktop": "linux",
				"mobile":  "android",
				"notify":  "always",
			},
			args:      []any{"$.desktop", "linux", "$.mobile", "android", "$.notify", "always"},
			argString: "?, ?, ?, ?, ?, ?",
		},
		{
			props:     map[string]string{},
			args:      nil,
			argString: "",
		},
	}

	for _, test := range tests {
		args, argString := constructMySQLJSONArgs(test.props)
		assert.ElementsMatch(t, test.args, args)
		assert.Equal(t, test.argString, argString)
	}
}

func TestScanRowsIntoMap(t *testing.T) {
	StoreTest(t, func(t *testing.T, rctx request.CTX, ss store.Store) {
		sqlStore := ss.(*SqlStore)

		t.Run("basic mapping", func(t *testing.T) {
			// Create a test table
			_, err := sqlStore.GetMaster().Exec(`
				CREATE TEMPORARY TABLE IF NOT EXISTS MapTest (
					id VARCHAR(50) PRIMARY KEY,
					value INT
				)
			`)
			require.NoError(t, err)

			// Insert test data
			_, err = sqlStore.GetMaster().Exec(`
				INSERT INTO MapTest VALUES ('key1', 10), ('key2', 20), ('key3', 30)
			`)
			require.NoError(t, err)

			// Query the data
			rows, err := sqlStore.GetMaster().Query(`SELECT id, value FROM MapTest ORDER BY id`)
			require.NoError(t, err)
			defer rows.Close()

			// Create scanner function
			scanner := func(rows *sql.Rows) (string, int, error) {
				var key string
				var value int
				return key, value, rows.Scan(&key, &value)
			}

			// Call the function under test
			result, err := scanRowsIntoMap(rows, scanner, nil)

			// Assert results
			require.NoError(t, err)
			require.Len(t, result, 3)
			require.Equal(t, 10, result["key1"])
			require.Equal(t, 20, result["key2"])
			require.Equal(t, 30, result["key3"])
		})

		t.Run("with default values", func(t *testing.T) {
			// Create a test table
			_, err := sqlStore.GetMaster().Exec(`
				CREATE TEMPORARY TABLE IF NOT EXISTS MapTestDefaults (
					id VARCHAR(50) PRIMARY KEY,
					value INT
				)
			`)
			require.NoError(t, err)

			// Insert test data - only insert one key to test defaults
			_, err = sqlStore.GetMaster().Exec(`
				INSERT INTO MapTestDefaults VALUES ('key1', 10)
			`)
			require.NoError(t, err)

			// Query the data
			rows, err := sqlStore.GetMaster().Query(`SELECT id, value FROM MapTestDefaults`)
			require.NoError(t, err)
			defer rows.Close()

			// Create scanner function
			scanner := func(rows *sql.Rows) (string, int, error) {
				var key string
				var value int
				return key, value, rows.Scan(&key, &value)
			}

			// Define defaults
			defaults := map[string]int{
				"key1": 100, // Should be overwritten
				"key2": 200, // Should remain
				"key3": 300, // Should remain
			}

			// Call the function under test
			result, err := scanRowsIntoMap(rows, scanner, defaults)

			// Assert results
			require.NoError(t, err)
			require.Len(t, result, 3)
			require.Equal(t, 10, result["key1"])  // Should be from DB, not default
			require.Equal(t, 200, result["key2"]) // Should be from defaults
			require.Equal(t, 300, result["key3"]) // Should be from defaults
		})

		t.Run("with empty result set", func(t *testing.T) {
			// Create a test table
			_, err := sqlStore.GetMaster().Exec(`
				CREATE TEMPORARY TABLE IF NOT EXISTS MapTestEmpty (
					id VARCHAR(50) PRIMARY KEY,
					value INT
				)
			`)
			require.NoError(t, err)

			// Query the empty table
			rows, err := sqlStore.GetMaster().Query(`SELECT id, value FROM MapTestEmpty`)
			require.NoError(t, err)
			defer rows.Close()

			// Create scanner function
			scanner := func(rows *sql.Rows) (string, int, error) {
				var key string
				var value int
				return key, value, rows.Scan(&key, &value)
			}

			// Define defaults
			defaults := map[string]int{
				"key1": 100,
				"key2": 200,
			}

			// Call the function under test
			result, err := scanRowsIntoMap(rows, scanner, defaults)

			// Assert results
			require.NoError(t, err)
			require.Len(t, result, 2)
			require.Equal(t, 100, result["key1"]) // Should be from defaults
			require.Equal(t, 200, result["key2"]) // Should be from defaults
		})
	})
}
