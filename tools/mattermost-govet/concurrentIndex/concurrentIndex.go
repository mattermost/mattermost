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
	createIndexRegex       = regexp.MustCompile(`(?i)\bCREATE\s+(UNIQUE\s+)?INDEX\b`)
	concurrentlyRegex      = regexp.MustCompile(`(?i)\bCREATE\s+(UNIQUE\s+)?INDEX\s+CONCURRENTLY\b`)
	createIfNotExistsRegex = regexp.MustCompile(`(?i)\bCREATE\s+(UNIQUE\s+)?INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS\b`)
	dropIndexRegex         = regexp.MustCompile(`(?i)\bDROP\s+INDEX\b`)
	dropConcurrentlyRegex  = regexp.MustCompile(`(?i)\bDROP\s+INDEX\s+CONCURRENTLY\b`)
	dropIfExistsRegex      = regexp.MustCompile(`(?i)\bDROP\s+INDEX\s+CONCURRENTLY\s+IF\s+EXISTS\b`)
	ignoreRegex            = regexp.MustCompile(`--\s*concurrentIndex:ignore\b`)
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
	code  string // text with -- line comments removed
}

// splitStatements splits s on semicolons outside quoted strings, quoted
// identifiers and -- line comments.
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
	inComment := false
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case inComment:
			if c != '\n' {
				continue
			}
			inComment = false
		case quote != 0:
			if c == quote {
				quote = 0
			}
		case c == '\'' || c == '"':
			quote = c
		case c == '-' && i+1 < len(s) && s[i+1] == '-':
			inComment = true
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
	stmt := st.code
	if createIndexRegex.MatchString(stmt) {
		if !concurrentlyRegex.MatchString(stmt) {
			return diagCreateIndex
		}
		if !createIfNotExistsRegex.MatchString(stmt) {
			return diagCreateIfNotExists
		}
	}
	if dropIndexRegex.MatchString(stmt) {
		if !dropConcurrentlyRegex.MatchString(stmt) {
			return diagDropIndex
		}
		if !dropIfExistsRegex.MatchString(stmt) {
			return diagDropIfExists
		}
	}
	return ""
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
