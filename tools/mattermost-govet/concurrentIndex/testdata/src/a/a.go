package a

func example() {
	// CREATE INDEX without CONCURRENTLY should trigger warnings
	_ = "CREATE INDEX IF NOT EXISTS idx_foo_bar ON foo (bar)"         // want `use CREATE INDEX CONCURRENTLY instead of CREATE INDEX to avoid blocking DML`
	_ = "CREATE INDEX idx_foo_bar ON foo (bar)"                       // want `use CREATE INDEX CONCURRENTLY instead of CREATE INDEX to avoid blocking DML`
	_ = "create index if not exists idx_foo_bar on foo (bar)"         // want `use CREATE INDEX CONCURRENTLY instead of CREATE INDEX to avoid blocking DML`
	_ = "CREATE UNIQUE INDEX IF NOT EXISTS idx_foo_bar ON foo (bar)"  // want `use CREATE INDEX CONCURRENTLY instead of CREATE INDEX to avoid blocking DML`
	_ = "create unique index idx_foo_bar on foo (bar)"                // want `use CREATE INDEX CONCURRENTLY instead of CREATE INDEX to avoid blocking DML`

	// DROP INDEX without CONCURRENTLY should trigger warnings
	_ = "DROP INDEX IF EXISTS idx_foo_bar"  // want `use DROP INDEX CONCURRENTLY instead of DROP INDEX to avoid blocking DML`
	_ = "DROP INDEX idx_foo_bar"            // want `use DROP INDEX CONCURRENTLY instead of DROP INDEX to avoid blocking DML`
	_ = "drop index if exists idx_foo_bar"  // want `use DROP INDEX CONCURRENTLY instead of DROP INDEX to avoid blocking DML`

	// CREATE INDEX CONCURRENTLY should not trigger warnings
	_ = "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_foo_bar ON foo (bar)"
	_ = "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_foo_bar ON foo (bar)"
	_ = "create index concurrently if not exists idx_foo_bar on foo (bar)"
	_ = "create unique index concurrently idx_foo_bar on foo (bar)"

	// DROP INDEX CONCURRENTLY should not trigger warnings
	_ = "DROP INDEX CONCURRENTLY IF EXISTS idx_foo_bar"
	_ = "drop index concurrently if exists idx_foo_bar"

	// Unrelated strings should not trigger warnings
	_ = "SELECT * FROM indexes"
	_ = "just a regular string"
	_ = "CREATE TABLE foo (id int)"
}

func exampleBacktick() {
	// Backtick strings should also be checked
	_ = `CREATE INDEX IF NOT EXISTS idx_foo_bar ON foo (bar)`        // want `use CREATE INDEX CONCURRENTLY instead of CREATE INDEX to avoid blocking DML`
	_ = `DROP INDEX IF EXISTS idx_foo_bar`                           // want `use DROP INDEX CONCURRENTLY instead of DROP INDEX to avoid blocking DML`
	_ = `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_foo_bar ON foo (bar)`
	_ = `DROP INDEX CONCURRENTLY IF EXISTS idx_foo_bar`

}
