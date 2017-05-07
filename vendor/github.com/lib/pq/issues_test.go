package pq

import "testing"

func TestIssue494(t *testing.T) {
	db := openTestConn(t)
	defer db.Close()

	query := `CREATE TEMP TABLE t (i INT PRIMARY KEY)`
	if _, err := db.Exec(query); err != nil {
		t.Fatal(err)
	}

	txn, err := db.Begin()
	if err != nil {
		t.Fatal(err)
	}

	if _, err := txn.Prepare(CopyIn("t", "i")); err != nil {
		t.Fatal(err)
	}

	if _, err := txn.Query("SELECT 1"); err == nil {
		t.Fatal("expected error")
	}
}
