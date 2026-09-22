// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unicode"

	"github.com/wiggin77/merror"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// defaultMaxInsertParams is a conservative threshold (76% of PostgreSQL's
// 65,535 parameter limit) used to chunk bulk INSERT statements so they never
// overflow the wire-protocol's 16-bit parameter counter.
const defaultMaxInsertParams = 50_000

// chunkSlice splits items into sub-slices sized so that each chunk uses at most
// maxParams query parameters (columnsPerRow params per item). When the input
// already fits in one chunk the original slice is returned with zero allocation
// overhead.
func chunkSlice[T any](items []T, columnsPerRow int, maxParams int) [][]T {
	if columnsPerRow <= 0 {
		panic(fmt.Sprintf("chunkSlice: columnsPerRow must be > 0, got %d", columnsPerRow))
	}
	if maxParams <= 0 {
		panic(fmt.Sprintf("chunkSlice: maxParams must be > 0, got %d", maxParams))
	}
	if columnsPerRow > maxParams {
		panic(fmt.Sprintf("chunkSlice: columnsPerRow (%d) must be <= maxParams (%d)", columnsPerRow, maxParams))
	}
	if len(items) == 0 {
		return nil
	}
	chunkSize := maxParams / columnsPerRow
	if len(items) <= chunkSize {
		return [][]T{items}
	}
	var chunks [][]T
	for i := 0; i < len(items); i += chunkSize {
		end := min(i+chunkSize, len(items))
		chunks = append(chunks, items[i:end])
	}
	return chunks
}

var escapeLikeSearchChar = []string{
	"%",
	"_",
}

func sanitizeSearchTerm(term string, escapeChar string) string {
	term = strings.Replace(term, escapeChar, "", -1)

	for _, c := range escapeLikeSearchChar {
		term = strings.Replace(term, c, escapeChar+c, -1)
	}

	return term
}

// Converts a list of strings into a list of query parameters and a named parameter map that can
// be used as part of a SQL query.
func MapStringsToQueryParams(list []string, paramPrefix string) (string, map[string]any) {
	var keys strings.Builder
	params := make(map[string]any, len(list))
	for i, entry := range list {
		if keys.Len() > 0 {
			keys.WriteString(",")
		}

		key := paramPrefix + strconv.Itoa(i)
		keys.WriteString(":" + key)
		params[key] = entry
	}

	return "(" + keys.String() + ")", params
}

// finalizeTransactionX ensures a transaction is closed after use, rolling back if not already committed.
func finalizeTransactionX(transaction *sqlxTxWrapper, perr *error) {
	// Rollback returns sql.ErrTxDone if the transaction was already closed.
	if err := transaction.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
		*perr = merror.Append(*perr, err)
	}
}

func deferClose(c io.Closer, perr *error) {
	err := c.Close()
	*perr = merror.Append(*perr, err)
}

// removeNonAlphaNumericUnquotedTerms removes all unquoted words that only contain
// non-alphanumeric chars from given line
func removeNonAlphaNumericUnquotedTerms(line, separator string) string {
	words := strings.Split(line, separator)
	filteredResult := make([]string, 0, len(words))

	for _, w := range words {
		if isQuotedWord(w) || containsAlphaNumericChar(w) {
			filteredResult = append(filteredResult, strings.TrimSpace(w))
		}
	}
	return strings.Join(filteredResult, separator)
}

// containsAlphaNumericChar returns true in case any letter or digit is present, false otherwise
func containsAlphaNumericChar(s string) bool {
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			return true
		}
	}
	return false
}

// isQuotedWord return true if the input string is quoted, false otherwise. Ex :-
//
//	"quoted string"  -  will return true
//	unquoted string  -  will return false
func isQuotedWord(s string) bool {
	if len(s) < 2 {
		return false
	}

	return s[0] == '"' && s[len(s)-1] == '"'
}

func constructArrayArgs(ids []string) (string, []any) {
	var placeholder strings.Builder
	values := make([]any, 0, len(ids))
	for _, entry := range ids {
		if placeholder.Len() > 0 {
			placeholder.WriteString(",")
		}

		placeholder.WriteString("?")
		values = append(values, entry)
	}

	return "(" + placeholder.String() + ")", values
}

func wrapBinaryParamStringMap(ok bool, props model.StringMap) model.StringMap {
	if props == nil {
		props = make(model.StringMap)
	}
	props[model.BinaryParamKey] = strconv.FormatBool(ok)
	return props
}

// morphWriter is a target to pass to the logger instance of morph.
// For now, everything is just logged at a debug level. If we need to log
// errors/warnings from the library also, that needs to be seen later.
type morphWriter struct{}

func (l *morphWriter) Write(in []byte) (int, error) {
	mlog.Debug(strings.TrimSpace(string(in)))
	return len(in), nil
}

func DSNHasBinaryParam(dsn string) (bool, error) {
	url, err := url.Parse(dsn)
	if err != nil {
		return false, err
	}
	return url.Query().Get("binary_parameters") == "yes", nil
}

// AppendBinaryFlag updates the byte slice to work using binary_parameters=yes.
func AppendBinaryFlag(buf []byte) []byte {
	return append([]byte{0x01}, buf...)
}

const maxTokenSize = 50

// trimInput limits the string to a max size to prevent clogging up disk space
// while logging
func trimInput(input string) string {
	if len(input) > maxTokenSize {
		input = input[:maxTokenSize] + "..."
	}
	return input
}

// rowScanner is the minimal interface needed to iterate over SQL result rows.
type rowScanner interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
}

// neutralizeNonWordHyphens replaces any '-' that isn't flanked by a word
// rune (letter or digit) on both sides with a space, so malformed hyphen
// usage (leading/trailing/standalone/repeated) can't reach to_tsquery, while
// compound words like "t-shirt" are preserved.
func neutralizeNonWordHyphens(s string) string {
	if !strings.ContainsRune(s, '-') {
		return s
	}
	runes := []rune(s)
	for i, r := range runes {
		if r != '-' {
			continue
		}
		hasLeft := i > 0 && isWordRune(runes[i-1])
		hasRight := i < len(runes)-1 && isWordRune(runes[i+1])
		if !hasLeft || !hasRight {
			runes[i] = ' '
		}
	}
	return string(runes)
}

// isWordRune reports whether r can be part of a word for hyphen-flanking
// purposes. Combining marks (e.g. a decomposed accent) count too, since they
// attach to the preceding base letter rather than acting as a boundary.
func isWordRune(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r) || unicode.IsMark(r)
}

// numericTsQueryOperand matches an operand made up entirely of digits,
// optionally carrying the ":*" suffix that wildcard searches append.
var numericTsQueryOperand = regexp.MustCompile(`^[0-9]+(:\*)?$`)

// expandNumericTsQueryOperands rewrites every all-digit operand N of an
// assembled tsquery to "(N|-N)".
//
// Postgres' text-search parser reads the hyphen in "flight-12345" as a minus
// sign, so "check out flight-12345 today" indexes as
// 'flight':3 '-12345':4 — the digits are their own lexeme, but they carry the
// hyphen. Searching for "12345" therefore never matches. The extra branch
// targets the lexeme that is already in the index, so no reindexing is needed.
func expandNumericTsQueryOperands(tsQuery string) string {
	var b strings.Builder
	for rest := tsQuery; rest != ""; {
		open := strings.IndexByte(rest, '"')
		if open < 0 {
			b.WriteString(expandNumericOperands(rest))
			break
		}
		b.WriteString(expandNumericOperands(rest[:open]))

		closing := strings.IndexByte(rest[open+1:], '"')
		if closing < 0 {
			b.WriteString(rest[open:])
			break
		}
		closing += open + 1

		// A parenthesised group is a syntax error inside a quoted operand, but
		// Postgres parses "a<->b" and a<->b into the same tsquery, so the
		// quotes can be dropped from a phrase that needs expanding.
		quoted := rest[open+1 : closing]
		if expanded := expandNumericOperands(quoted); expanded != quoted {
			b.WriteString(expanded)
		} else {
			b.WriteString(rest[open : closing+1])
		}
		rest = rest[closing+1:]
	}

	return b.String()
}

// expandNumericOperands performs the rewrite on a quote-free stretch of an
// assembled tsquery. Operands are maximal runs between tsquery operators, so
// "flight-12345" and "#12345" stay whole and are left alone, while the
// standalone digits in "flight<->12345" are expanded.
func expandNumericOperands(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); {
		if isTsQueryOperatorByte(s[i]) {
			b.WriteByte(s[i])
			i++
			continue
		}

		start := i
		for i < len(s) && !isTsQueryOperatorByte(s[i]) {
			i++
		}

		operand := s[start:i]
		if numericTsQueryOperand.MatchString(operand) {
			b.WriteString("(" + operand + "|-" + operand + ")")
		} else {
			b.WriteString(operand)
		}
	}

	return b.String()
}

// isTsQueryOperatorByte reports whether c separates two operands of an
// assembled tsquery. All of them are ASCII, so a multi-byte rune can never be
// mistaken for one.
func isTsQueryOperatorByte(c byte) bool {
	switch c {
	case '&', '|', '!', '<', '>', '(', ')', ' ':
		return true
	}
	return false
}

// scanRowsIntoMap scans SQL rows into a map, using a provided scanner function to extract key-value pairs
func scanRowsIntoMap[K comparable, V any](rows rowScanner, scanner func(rows rowScanner) (K, V, error), defaults map[K]V) (map[K]V, error) {
	results := make(map[K]V, len(defaults))

	// Initialize with default values if provided
	maps.Copy(results, defaults)

	for rows.Next() {
		key, value, err := scanner(rows)
		if err != nil {
			return nil, err
		}
		results[key] = value
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error while iterating rows: %w", err)
	}

	return results, nil
}
