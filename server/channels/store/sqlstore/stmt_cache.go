// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
//
// This code is based on the squirrel StmtCache implementation

package sqlstore

import (
	"sync"

	"github.com/jmoiron/sqlx"
)

type Preparerx interface {
	Preparex(query string) (*sqlx.Stmt, error)
}

type StmtCache struct {
	prep  Preparerx
	cache map[string]*sqlx.Stmt
	mu    sync.Mutex
}

// Prepare delegates down to the underlying Preparer and caches the result
// using the provided query as a key
func (sc *StmtCache) Preparex(query string) (*sqlx.Stmt, error) {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	stmt, ok := sc.cache[query]
	if ok {
		return stmt, nil
	}
	stmt, err := sc.prep.Preparex(query)
	if err == nil {
		sc.cache[query] = stmt
	}
	return stmt, err
}

func NewStmtCache(prep Preparerx) *StmtCache {
	return &StmtCache{prep: prep, cache: make(map[string]*sqlx.Stmt)}
}
