// +build go1.8

package pq

import (
	"context"
	"database/sql"
	"testing"
	"time"
)

func TestMultipleSimpleQuery(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	rows, err := db.Query("select 1; set time zone default; select 2; select 3")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	var i int
	for rows.Next() {
		if err := rows.Scan(&i); err != nil {
			t.Fatal(err)
		}
		if i != 1 {
			t.Fatalf("expected 1, got %d", i)
		}
	}
	if !rows.NextResultSet() {
		t.Fatal("expected more result sets", rows.Err())
	}
	for rows.Next() {
		if err := rows.Scan(&i); err != nil {
			t.Fatal(err)
		}
		if i != 2 {
			t.Fatalf("expected 2, got %d", i)
		}
	}

	// Make sure that if we ignore a result we can still query.

	rows, err = db.Query("select 4; select 5")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		if err := rows.Scan(&i); err != nil {
			t.Fatal(err)
		}
		if i != 4 {
			t.Fatalf("expected 4, got %d", i)
		}
	}
	if !rows.NextResultSet() {
		t.Fatal("expected more result sets", rows.Err())
	}
	for rows.Next() {
		if err := rows.Scan(&i); err != nil {
			t.Fatal(err)
		}
		if i != 5 {
			t.Fatalf("expected 5, got %d", i)
		}
	}
	if rows.NextResultSet() {
		t.Fatal("unexpected result set")
	}
}

func TestContextCancelExec(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	ctx, cancel := context.WithCancel(context.Background())

	// Delay execution for just a bit until db.ExecContext has begun.
	go func() {
		time.Sleep(time.Millisecond * 10)
		cancel()
	}()

	// Not canceled until after the exec has started.
	if _, err := db.ExecContext(ctx, "select pg_sleep(1)"); err == nil {
		t.Fatal("expected error")
	} else if err.Error() != "pq: canceling statement due to user request" {
		t.Fatalf("unexpected error: %s", err)
	}

	// Context is already canceled, so error should come before execution.
	if _, err := db.ExecContext(ctx, "select pg_sleep(1)"); err == nil {
		t.Fatal("expected error")
	} else if err.Error() != "context canceled" {
		t.Fatalf("unexpected error: %s", err)
	}
}

func TestContextCancelQuery(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	ctx, cancel := context.WithCancel(context.Background())

	// Delay execution for just a bit until db.QueryContext has begun.
	go func() {
		time.Sleep(time.Millisecond * 10)
		cancel()
	}()

	// Not canceled until after the exec has started.
	if _, err := db.QueryContext(ctx, "select pg_sleep(1)"); err == nil {
		t.Fatal("expected error")
	} else if err.Error() != "pq: canceling statement due to user request" {
		t.Fatalf("unexpected error: %s", err)
	}

	// Context is already canceled, so error should come before execution.
	if _, err := db.QueryContext(ctx, "select pg_sleep(1)"); err == nil {
		t.Fatal("expected error")
	} else if err.Error() != "context canceled" {
		t.Fatalf("unexpected error: %s", err)
	}
}

func TestContextCancelBegin(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	ctx, cancel := context.WithCancel(context.Background())
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}

	// Delay execution for just a bit until tx.Exec has begun.
	go func() {
		time.Sleep(time.Millisecond * 10)
		cancel()
	}()

	// Not canceled until after the exec has started.
	if _, err := tx.Exec("select pg_sleep(1)"); err == nil {
		t.Fatal("expected error")
	} else if err.Error() != "pq: canceling statement due to user request" {
		t.Fatalf("unexpected error: %s", err)
	}

	// Transaction is canceled, so expect an error.
	if _, err := tx.Query("select pg_sleep(1)"); err == nil {
		t.Fatal("expected error")
	} else if err != sql.ErrTxDone {
		t.Fatalf("unexpected error: %s", err)
	}

	// Context is canceled, so cannot begin a transaction.
	if _, err := db.BeginTx(ctx, nil); err == nil {
		t.Fatal("expected error")
	} else if err.Error() != "context canceled" {
		t.Fatalf("unexpected error: %s", err)
	}
}
