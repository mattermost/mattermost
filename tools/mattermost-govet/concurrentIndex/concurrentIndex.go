// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package concurrentIndex

import (
	"go/ast"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/tools/go/analysis"
)

const (
	diagCreateIndex       = "use CREATE INDEX CONCURRENTLY instead of CREATE INDEX to avoid blocking DML"
	diagDropIndex         = "use DROP INDEX CONCURRENTLY instead of DROP INDEX to avoid blocking DML"
	diagCreateIfNotExists = "use CREATE INDEX CONCURRENTLY IF NOT EXISTS so a retried migration is idempotent"
	diagDropIfExists      = "use DROP INDEX CONCURRENTLY IF EXISTS so a retried migration is idempotent"
)

var (
	// Submatch 1 is CONCURRENTLY and submatch 2 the existence clause, so each
	// occurrence is judged on its own even if statement splitting goes wrong.
	createIndexRegex = regexp.MustCompile(`(?i)\bCREATE\s+(?:UNIQUE\s+)?INDEX\b(\s+CONCURRENTLY\b)?(\s+IF\s+NOT\s+EXISTS\b)?`)
	dropIndexRegex   = regexp.MustCompile(`(?i)\bDROP\s+INDEX\b(\s+CONCURRENTLY\b)?(\s+IF\s+EXISTS\b)?`)
	ignoreRegex      = regexp.MustCompile(`--\s*concurrentIndex:ignore\b`)
)

var sqlPath string
var minMigration int

var migrationNumberRegex = regexp.MustCompile(`^\d+`)

var Analyzer = &analysis.Analyzer{
	Name: "concurrentIndex",
	Doc:  "checks that CREATE INDEX and DROP INDEX use CONCURRENTLY to avoid blocking DML, with IF [NOT] EXISTS so retries are idempotent",
	Run:  run,
}

func init() {
	Analyzer.Flags.StringVar(&sqlPath, "path", "", "Relative path to a directory of .sql files to scan recursively")
	Analyzer.Flags.IntVar(&minMigration, "minMigration", 0, "Skip SQL files with a migration number below this value")
}

type statement struct {
	start int    // byte offset of the first non-space character
	text  string // raw text, including comments
	code  string // text with comments removed
}

func isIdentByte(c byte) bool {
	return c == '_' || c >= '0' && c <= '9' || c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z'
}

// splitStatements splits s on semicolons outside quoted strings, quoted
// identifiers, -- line comments and /* */ block comments.
func splitStatements(s string) []statement {
	var stmts []statement
	var code strings.Builder
	start := 0
	flush := func(end int) {
		text := s[start:end]
		if trimmed := strings.TrimLeft(text, " \t\r\n"); trimmed != "" {
			stmts = append(stmts, statement{start: end - len(trimmed), text: text, code: code.String()})
		}
		code.Reset()
		start = end + 1
	}

	var quote byte
	backslashEscapes := false
	inLineComment := false
	blockDepth := 0
	for i := 0; i < len(s); i++ {
		c := s[i]
		next := byte(0)
		if i+1 < len(s) {
			next = s[i+1]
		}
		switch {
		case inLineComment:
			if c != '\n' {
				continue
			}
			inLineComment = false
		case blockDepth > 0:
			switch {
			case c == '/' && next == '*':
				blockDepth++
				i++
			case c == '*' && next == '/':
				blockDepth--
				i++
				if blockDepth == 0 {
					code.WriteByte(' ')
				}
			}
			continue
		case quote != 0:
			if backslashEscapes && c == '\\' && next != 0 {
				code.WriteByte(c)
				code.WriteByte(next)
				i++
				continue
			}
			if c == quote {
				quote = 0
			}
		case c == '\'' || c == '"':
			quote = c
			// E'...' strings allow backslash escapes such as \'.
			backslashEscapes = c == '\'' && i > 0 && (s[i-1] == 'E' || s[i-1] == 'e') && (i < 2 || !isIdentByte(s[i-2]))
		case c == '-' && next == '-':
			inLineComment = true
			i++
			continue
		case c == '/' && next == '*':
			blockDepth = 1
			i++
			continue
		case c == ';':
			flush(i)
			continue
		}
		code.WriteByte(c)
	}
	flush(len(s))
	return stmts
}

func checkStatement(st statement) string {
	if ignoreRegex.MatchString(st.text) {
		return ""
	}
	if msg := checkIndexDDL(st.code, createIndexRegex, diagCreateIndex, diagCreateIfNotExists); msg != "" {
		return msg
	}
	return checkIndexDDL(st.code, dropIndexRegex, diagDropIndex, diagDropIfExists)
}

func checkIndexDDL(code string, re *regexp.Regexp, missingConcurrently, missingExistence string) string {
	msg := ""
	for _, m := range re.FindAllStringSubmatch(code, -1) {
		if m[1] == "" {
			return missingConcurrently
		}
		if m[2] == "" {
			msg = missingExistence
		}
	}
	return msg
}

func containsIndexKeyword(s string) bool {
	return strings.Contains(strings.ToLower(s), "index")
}

func checkLine(line string) string {
	if !containsIndexKeyword(line) {
		return ""
	}
	for _, st := range splitStatements(line) {
		if msg := checkStatement(st); msg != "" {
			return msg
		}
	}
	return ""
}

func run(pass *analysis.Pass) (interface{}, error) {
	for _, file := range pass.Files {
		if strings.HasSuffix(pass.Fset.File(file.Pos()).Name(), "_test.go") {
			continue
		}
		ast.Inspect(file, func(node ast.Node) bool {
			lit, ok := node.(*ast.BasicLit)
			if !ok || lit.Kind != token.STRING {
				return true
			}

			val, err := strconv.Unquote(lit.Value)
			if err != nil {
				val = strings.Trim(lit.Value, "`")
			}

			if msg := checkLine(val); msg != "" {
				pass.Reportf(lit.Pos(), "%s", msg)
			}
			return true
		})
	}

	if sqlPath != "" {
		if err := scanSQLDir(pass, sqlPath); err != nil {
			return nil, err
		}
	}

	return nil, nil
}

func getMigrationNumberFromFilename(filename string) int {
	m := migrationNumberRegex.FindString(filename)
	if m == "" {
		return -1
	}
	n, _ := strconv.Atoi(m)
	return n
}

func scanSQLDir(pass *analysis.Pass, root string) error {
	return filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		if d.IsDir() || !strings.HasSuffix(path, ".sql") {
			return nil
		}
		if minMigration > 0 {
			if n := getMigrationNumberFromFilename(d.Name()); n >= 0 && n < minMigration {
				return nil
			}
		}
		return checkSQLFile(pass, path)
	})
}

func checkSQLFile(pass *analysis.Pass, name string) error {
	content, err := os.ReadFile(name)
	if err != nil {
		return err
	}

	if !containsIndexKeyword(string(content)) {
		return nil
	}

	tf := pass.Fset.AddFile(name, -1, len(content))
	tf.SetLinesForContent(content)

	for _, st := range splitStatements(string(content)) {
		if msg := checkStatement(st); msg != "" {
			pass.Reportf(tf.Pos(st.start), "%s", msg)
		}
	}

	return nil
}
