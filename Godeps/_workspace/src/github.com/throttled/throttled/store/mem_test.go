package store

import (
	"testing"
	"time"
)

func TestMemStore(t *testing.T) {
	st := NewMemStore(0)
	win := time.Second

	// Reset stores a key with count of 1, current timestamp
	err := st.Reset("k", time.Second)
	if err != nil {
		t.Errorf("expected reset to return nil, got %s", err)
	}
	cnt, sec1, _ := st.Incr("k", win)
	if cnt != 2 {
		t.Errorf("expected reset+incr to set count to 2, got %d", cnt)
	}

	// Incr increments the key, keeps same timestamp
	cnt, sec2, err := st.Incr("k", win)
	if err != nil {
		t.Errorf("expected 2nd incr to return nil error, got %s", err)
	}
	if cnt != 3 {
		t.Errorf("expected 2nd incr to return 3, got %d", cnt)
	}
	if sec1 != sec2 {
		t.Errorf("expected 2nd incr to return %d secs, got %d", sec1, sec2)
	}

	// Reset on existing key brings it back to 1, new timestamp
	err = st.Reset("k", win)
	if err != nil {
		t.Errorf("expected reset on existing key to return nil, got %s", err)
	}
	cnt, _, _ = st.Incr("k", win)
	if cnt != 2 {
		t.Errorf("expected last reset+incr to return 2, got %d", cnt)
	}
}
