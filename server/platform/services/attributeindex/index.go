// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package attributeindex holds user attributes and session attributes in an
// in-process SQLite database on a memory-backed filesystem, in separate tables,
// so that a policy over both can be answered by one query.
//
// The index is a derived cache, never a source of record. User rows are rebuilt
// from the database; session rows are re-learned from the session attribute
// feed. Every active user needs a row, including users with no custom
// attributes, because queries are rooted in users.
package attributeindex

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	_ "modernc.org/sqlite"
)

// Attributes are stored as SQLite JSONB rather than JSON text so that ->> reads
// them without re-parsing every row; read them back as text with json().
const schema = `
CREATE TABLE users (
	user_id         TEXT PRIMARY KEY,
	email           TEXT NOT NULL,
	email_verified  INTEGER NOT NULL,
	is_bot          INTEGER NOT NULL,
	create_at       INTEGER NOT NULL,
	attributes_json BLOB NOT NULL CHECK (json_valid(attributes_json, 8))
);

CREATE TABLE sessions (
	session_id           TEXT PRIMARY KEY,
	user_id              TEXT NOT NULL,
	expires_at           INTEGER NOT NULL,
	attributes_json      BLOB NOT NULL CHECK (json_valid(attributes_json, 8)),
	attribute_times_json BLOB NOT NULL CHECK (json_valid(attribute_times_json, 8))
);

CREATE INDEX idx_sessions_user ON sessions (user_id, expires_at);
`

// neverExpires is stored for sessions whose ExpiresAt is zero or negative, which
// Mattermost treats as not expiring, so that a live-session filter stays the
// single comparison expires_at > now.
const neverExpires = math.MaxInt64

var attributeNamePattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

// User is one row of the users table.
type User struct {
	ID            string
	Email         string
	EmailVerified bool
	IsBot         bool
	CreateAt      int64
	Attributes    map[string]any
}

// SessionUpdate carries a session's identity and any attribute values observed
// for it. Values are merged per key with the same rule as the session attribute
// cache: a value never overwrites one with a newer timestamp.
type SessionUpdate struct {
	SessionID string
	UserID    string
	ExpiresAt int64
	Attrs     map[string]any
	UpdatedAt int64
}

// Query selects user ids. Where is a boolean SQL expression over the users
// table aliased u, which may correlate to sessions; it comes from the policy
// compiler and must never contain caller input other than through Args.
type Query struct {
	Where   string
	Args    []any
	AfterID string
	Limit   int
}

type Stats struct {
	Users    int64
	Sessions int64
	Bytes    int64
}

// Options configures an Index.
type Options struct {
	// Dir is where the index keeps its database file. It should be a
	// memory-backed filesystem; when empty, /dev/shm is used if it exists and
	// os.TempDir otherwise.
	Dir string
	// MaxReaders bounds the number of concurrent searches.
	MaxReaders int
}

// Index is safe for concurrent use. Writes are serialized on one connection;
// searches run on a separate read-only pool, so no compiled query can modify
// the index, and in WAL mode they read a consistent snapshot without blocking
// writes.
type Index struct {
	dir     string
	writeMu sync.Mutex
	writeDB *sql.DB
	writer  *sql.Conn
	readDB  *sql.DB
}

// New creates an empty index. SQLite's in-memory VFS is not used because it
// refuses writes past 1 GiB, which a million users with sessions exceeds.
func New(ctx context.Context, opts Options) (*Index, error) {
	if opts.MaxReaders < 1 {
		return nil, errors.New("attributeindex: MaxReaders must be at least 1")
	}
	parent := opts.Dir
	if parent == "" {
		parent = defaultDir()
	}
	// MkdirTemp creates the directory 0700, so only this process's user can
	// read the session attributes kept in it.
	dir, err := os.MkdirTemp(parent, "attributeindex-")
	if err != nil {
		return nil, wrap(err, "create directory")
	}
	ix := &Index{dir: dir}
	if err := ix.open(ctx, opts.MaxReaders); err != nil {
		return nil, errors.Join(err, ix.Close())
	}
	return ix, nil
}

func defaultDir() string {
	if info, err := os.Stat("/dev/shm"); err == nil && info.IsDir() {
		return "/dev/shm"
	}
	return os.TempDir()
}

func (ix *Index) open(ctx context.Context, maxReaders int) error {
	// The file is a disposable cache, so writes skip fsync.
	dsn := "file:" + filepath.Join(ix.dir, "index.db") +
		"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=synchronous(OFF)&_pragma=temp_store(MEMORY)"

	var err error
	if ix.writeDB, err = sql.Open("sqlite", dsn); err != nil {
		return wrap(err, "open writer")
	}
	if ix.writer, err = ix.writeDB.Conn(ctx); err != nil {
		return wrap(err, "connect writer")
	}
	if _, err = ix.writer.ExecContext(ctx, schema); err != nil {
		return wrap(err, "create schema")
	}
	if ix.readDB, err = sql.Open("sqlite", dsn+"&_pragma=query_only(1)"); err != nil {
		return wrap(err, "open readers")
	}
	ix.readDB.SetMaxOpenConns(maxReaders)
	ix.readDB.SetMaxIdleConns(maxReaders)
	return nil
}

// Close releases the index and deletes its database file.
func (ix *Index) Close() error {
	ix.writeMu.Lock()
	defer ix.writeMu.Unlock()
	var errs []error
	if ix.readDB != nil {
		errs = append(errs, ix.readDB.Close())
	}
	if ix.writer != nil {
		errs = append(errs, ix.writer.Close())
	}
	if ix.writeDB != nil {
		errs = append(errs, ix.writeDB.Close())
	}
	errs = append(errs, os.RemoveAll(ix.dir))
	return wrap(errors.Join(errs...), "close")
}

func wrap(err error, op string) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("attributeindex: %s: %w", op, err)
}

func (ix *Index) inTx(ctx context.Context, fn func(tx *sql.Tx) error) error {
	ix.writeMu.Lock()
	defer ix.writeMu.Unlock()
	tx, err := ix.writer.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// UpsertUsers inserts or replaces whole user rows.
func (ix *Index) UpsertUsers(ctx context.Context, users []User) error {
	err := ix.inTx(ctx, func(tx *sql.Tx) error {
		stmt, err := tx.PrepareContext(ctx, `
			INSERT INTO users (user_id, email, email_verified, is_bot, create_at, attributes_json)
			VALUES (?, ?, ?, ?, ?, jsonb(?))
			ON CONFLICT (user_id) DO UPDATE SET
				email = excluded.email,
				email_verified = excluded.email_verified,
				is_bot = excluded.is_bot,
				create_at = excluded.create_at,
				attributes_json = excluded.attributes_json`)
		if err != nil {
			return err
		}
		defer stmt.Close()
		for _, u := range users {
			attrs := u.Attributes
			if attrs == nil {
				attrs = map[string]any{}
			}
			raw, err := json.Marshal(attrs)
			if err != nil {
				return fmt.Errorf("user %s: %w", u.ID, err)
			}
			if _, err := stmt.ExecContext(ctx, u.ID, u.Email, u.EmailVerified, u.IsBot, u.CreateAt, string(raw)); err != nil {
				return fmt.Errorf("user %s: %w", u.ID, err)
			}
		}
		return nil
	})
	return wrap(err, "upsert users")
}

// RemoveUsers deletes users and their sessions.
func (ix *Index) RemoveUsers(ctx context.Context, userIDs []string) error {
	err := ix.inTx(ctx, func(tx *sql.Tx) error {
		for _, id := range userIDs {
			if _, err := tx.ExecContext(ctx, `DELETE FROM users WHERE user_id = ?`, id); err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `DELETE FROM sessions WHERE user_id = ?`, id); err != nil {
				return err
			}
		}
		return nil
	})
	return wrap(err, "remove users")
}

// ApplySessionUpdates applies a batch of session updates in one transaction.
// An update with no attributes records the session's identity only.
func (ix *Index) ApplySessionUpdates(ctx context.Context, updates []SessionUpdate) error {
	err := ix.inTx(ctx, func(tx *sql.Tx) error {
		read, err := tx.PrepareContext(ctx, `SELECT json(attributes_json), json(attribute_times_json) FROM sessions WHERE session_id = ?`)
		if err != nil {
			return err
		}
		defer read.Close()
		write, err := tx.PrepareContext(ctx, `
			INSERT INTO sessions (session_id, user_id, expires_at, attributes_json, attribute_times_json)
			VALUES (?, ?, ?, jsonb(?), jsonb(?))
			ON CONFLICT (session_id) DO UPDATE SET
				user_id = excluded.user_id,
				expires_at = excluded.expires_at,
				attributes_json = excluded.attributes_json,
				attribute_times_json = excluded.attribute_times_json`)
		if err != nil {
			return err
		}
		defer write.Close()

		for _, u := range updates {
			if u.SessionID == "" || u.UserID == "" {
				return errors.New("session update needs a session id and a user id")
			}
			attrs, times, err := readSessionAttributes(ctx, read, u.SessionID)
			if err != nil {
				return fmt.Errorf("session %s: %w", u.SessionID, err)
			}
			mergeAttributes(attrs, times, u.Attrs, u.UpdatedAt)

			newAttrs, err := json.Marshal(attrs)
			if err != nil {
				return fmt.Errorf("session %s attributes: %w", u.SessionID, err)
			}
			newTimes, err := json.Marshal(times)
			if err != nil {
				return fmt.Errorf("session %s attribute times: %w", u.SessionID, err)
			}
			expiresAt := u.ExpiresAt
			if expiresAt <= 0 {
				expiresAt = neverExpires
			}
			if _, err := write.ExecContext(ctx, u.SessionID, u.UserID, expiresAt, string(newAttrs), string(newTimes)); err != nil {
				return fmt.Errorf("session %s: %w", u.SessionID, err)
			}
		}
		return nil
	})
	return wrap(err, "apply session updates")
}

// readSessionAttributes returns empty maps for a session the index has not seen.
func readSessionAttributes(ctx context.Context, read *sql.Stmt, sessionID string) (map[string]any, map[string]int64, error) {
	attrs := map[string]any{}
	times := map[string]int64{}
	var rawAttrs, rawTimes string
	err := read.QueryRowContext(ctx, sessionID).Scan(&rawAttrs, &rawTimes)
	if errors.Is(err, sql.ErrNoRows) {
		return attrs, times, nil
	}
	if err != nil {
		return nil, nil, err
	}
	if err = json.Unmarshal([]byte(rawAttrs), &attrs); err != nil {
		return nil, nil, fmt.Errorf("attributes: %w", err)
	}
	if err = json.Unmarshal([]byte(rawTimes), &times); err != nil {
		return nil, nil, fmt.Errorf("attribute times: %w", err)
	}
	return attrs, times, nil
}

// mergeAttributes mirrors LocalCacheSessionAttributeStore.Refresh, so the index
// and the cache converge on the same values whatever order updates arrive in.
func mergeAttributes(attrs map[string]any, times map[string]int64, incoming map[string]any, updatedAt int64) {
	for key, value := range incoming {
		if times[key] > updatedAt {
			continue
		}
		attrs[key] = value
		times[key] = updatedAt
	}
}

func (ix *Index) RemoveSessions(ctx context.Context, sessionIDs []string) error {
	err := ix.inTx(ctx, func(tx *sql.Tx) error {
		for _, id := range sessionIDs {
			if _, err := tx.ExecContext(ctx, `DELETE FROM sessions WHERE session_id = ?`, id); err != nil {
				return err
			}
		}
		return nil
	})
	return wrap(err, "remove sessions")
}

func (ix *Index) RemoveAllSessions(ctx context.Context) error {
	err := ix.inTx(ctx, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `DELETE FROM sessions`)
		return err
	})
	return wrap(err, "remove all sessions")
}

// RemoveExpiredSessions reclaims memory only: queries already ignore expired
// sessions through expires_at, so correctness never depends on when it runs.
func (ix *Index) RemoveExpiredSessions(ctx context.Context, now int64) (int64, error) {
	var removed int64
	err := ix.inTx(ctx, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at <= ?`, now)
		if err != nil {
			return err
		}
		removed, err = res.RowsAffected()
		return err
	})
	return removed, wrap(err, "remove expired sessions")
}

// EnsureUserAttributeIndex adds an expression index on a user attribute. The
// planner uses it only for predicates spelled exactly attributes_json ->> 'name'.
func (ix *Index) EnsureUserAttributeIndex(ctx context.Context, name string) error {
	return ix.ensureAttributeIndex(ctx, "users", name)
}

// EnsureSessionAttributeIndex adds an expression index on a session attribute.
func (ix *Index) EnsureSessionAttributeIndex(ctx context.Context, name string) error {
	return ix.ensureAttributeIndex(ctx, "sessions", name)
}

func (ix *Index) ensureAttributeIndex(ctx context.Context, table, name string) error {
	// DDL cannot take parameters, so the name is spliced in and must be an
	// identifier, which is also the only shape a CEL selector can reference.
	if !attributeNamePattern.MatchString(name) {
		return fmt.Errorf("attributeindex: invalid attribute name %q", name)
	}
	ddl := fmt.Sprintf(`CREATE INDEX IF NOT EXISTS idx_%s_attr_%s ON %s (attributes_json ->> '%s')`, table, name, table, name)
	err := ix.inTx(ctx, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, ddl)
		return err
	})
	return wrap(err, "index "+table+"."+name)
}

// SearchUserIDs returns at most q.Limit user ids matching q.Where, in id order,
// starting after q.AfterID.
func (ix *Index) SearchUserIDs(ctx context.Context, q Query) ([]string, error) {
	if strings.TrimSpace(q.Where) == "" {
		return nil, errors.New("attributeindex: empty query")
	}
	if q.Limit <= 0 {
		return nil, errors.New("attributeindex: limit must be positive")
	}
	args := append(append(make([]any, 0, len(q.Args)+2), q.Args...), q.AfterID, q.Limit)
	rows, err := ix.readDB.QueryContext(ctx,
		`SELECT u.user_id FROM users u WHERE (`+q.Where+`) AND u.user_id > ? ORDER BY u.user_id LIMIT ?`, args...)
	if err != nil {
		return nil, wrap(err, "search")
	}
	defer rows.Close()

	ids := make([]string, 0, q.Limit)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, wrap(err, "search")
		}
		ids = append(ids, id)
	}
	return ids, wrap(rows.Err(), "search")
}

func (ix *Index) CountUsers(ctx context.Context, where string, args ...any) (int64, error) {
	if strings.TrimSpace(where) == "" {
		return 0, errors.New("attributeindex: empty query")
	}
	var n int64
	err := ix.readDB.QueryRowContext(ctx, `SELECT count(*) FROM users u WHERE (`+where+`)`, args...).Scan(&n)
	return n, wrap(err, "count")
}

func (ix *Index) Stats(ctx context.Context) (Stats, error) {
	var s Stats
	err := ix.readDB.QueryRowContext(ctx, `
		SELECT
			(SELECT count(*) FROM users),
			(SELECT count(*) FROM sessions),
			(SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size())`,
	).Scan(&s.Users, &s.Sessions, &s.Bytes)
	return s, wrap(err, "stats")
}
