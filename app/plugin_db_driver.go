// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"sync"

	"github.com/mattermost/mattermost-server/v5/model"
)

type DriverImpl struct {
	s         *Server
	connMut   sync.RWMutex
	connMap   map[string]*connObj
	txMut     sync.Mutex
	txMap     map[string]driver.Tx
	stMut     sync.Mutex
	stMap     map[string]*stmtObj
	rowsMut   sync.Mutex
	rowsMap   map[string]driver.Rows
	resultMut sync.Mutex
	resultMap map[string]driver.Result
}

type connObj struct {
	conn    *sql.Conn
	results []string
}

type stmtObj struct {
	stmt    driver.Stmt
	results []string
}

func NewDriverImpl(s *Server) *DriverImpl {
	return &DriverImpl{
		s:         s,
		connMap:   make(map[string]*connObj),
		txMap:     make(map[string]driver.Tx),
		stMap:     make(map[string]*stmtObj),
		rowsMap:   make(map[string]driver.Rows),
		resultMap: make(map[string]driver.Result),
	}
}

func (d *DriverImpl) Conn() (string, error) {
	conn, err := d.s.sqlStore.GetMaster().Db.Conn(context.Background())
	if err != nil {
		return "", err
	}
	connID := model.NewId()
	d.connMut.Lock()
	d.connMap[connID] = &connObj{conn: conn}
	d.connMut.Unlock()
	return connID, nil
}

func (d *DriverImpl) ConnPing(connID string) error {
	d.connMut.RLock()
	conn := d.connMap[connID].conn
	d.connMut.RUnlock()
	return conn.Raw(func(innerConn interface{}) error {
		return innerConn.(driver.Pinger).Ping(context.Background())
	})
}

func (d *DriverImpl) ConnQuery(connID, q string, args []driver.NamedValue) (_ string, err error) {
	var rows driver.Rows
	d.connMut.RLock()
	conn := d.connMap[connID].conn
	d.connMut.RUnlock()
	err = conn.Raw(func(innerConn interface{}) error {
		rows, err = innerConn.(driver.QueryerContext).QueryContext(context.Background(), q, args)
		return err
	})
	if err != nil {
		return "", err
	}

	rowsID := model.NewId()
	d.rowsMut.Lock()
	d.rowsMap[rowsID] = rows
	d.rowsMut.Unlock()

	return rowsID, nil
}

func (d *DriverImpl) ConnExec(connID, q string, args []driver.NamedValue) (_ string, err error) {
	var res driver.Result
	d.connMut.RLock()
	conn := d.connMap[connID].conn
	d.connMut.RUnlock()
	err = conn.Raw(func(innerConn interface{}) error {
		res, err = innerConn.(driver.ExecerContext).ExecContext(context.Background(), q, args)
		return err
	})
	if err != nil {
		return "", err
	}

	resID := model.NewId()
	d.connMut.Lock()
	d.connMap[connID].results = append(d.connMap[connID].results, resID)
	d.connMut.Unlock()

	d.resultMut.Lock()
	d.resultMap[resID] = res
	d.resultMut.Unlock()

	return resID, nil
}

func (d *DriverImpl) ConnClose(connID string) error {
	var results []string
	d.connMut.Lock()
	err := d.connMap[connID].conn.Close()
	results = append(results, d.connMap[connID].results...)
	delete(d.connMap, connID)
	d.connMut.Unlock()

	d.resultMut.Lock()
	for _, res := range results {
		delete(d.resultMap, res)
	}
	d.resultMut.Unlock()

	return err
}

func (d *DriverImpl) Tx(connID string, opts driver.TxOptions) (_ string, err error) {
	var tx driver.Tx
	d.connMut.RLock()
	conn := d.connMap[connID].conn
	d.connMut.RUnlock()
	err = conn.Raw(func(innerConn interface{}) error {
		tx, err = innerConn.(driver.ConnBeginTx).BeginTx(context.Background(), opts)
		return err
	})
	if err != nil {
		return "", err
	}
	txID := model.NewId()
	d.txMut.Lock()
	d.txMap[txID] = tx
	d.txMut.Unlock()
	return txID, nil
}

func (d *DriverImpl) TxCommit(txID string) error {
	d.txMut.Lock()
	defer d.txMut.Unlock()
	err := d.txMap[txID].Commit()
	delete(d.txMap, txID)
	return err
}

func (d *DriverImpl) TxRollback(txID string) error {
	d.txMut.Lock()
	defer d.txMut.Unlock()
	err := d.txMap[txID].Rollback()
	delete(d.txMap, txID)
	return err
}

func (d *DriverImpl) Stmt(connID, q string) (_ string, err error) {
	var stmt driver.Stmt
	d.connMut.RLock()
	conn := d.connMap[connID].conn
	d.connMut.RUnlock()
	err = conn.Raw(func(innerConn interface{}) error {
		stmt, err = innerConn.(driver.Conn).Prepare(q)
		return err
	})
	if err != nil {
		return "", err
	}

	stID := model.NewId()
	d.stMut.Lock()
	d.stMap[stID] = &stmtObj{stmt: stmt}
	d.stMut.Unlock()
	return stID, nil
}

func (d *DriverImpl) StmtClose(stID string) error {
	var results []string
	d.stMut.Lock()
	err := d.stMap[stID].stmt.Close()
	results = append(results, d.stMap[stID].results...)
	delete(d.stMap, stID)
	d.stMut.Unlock()

	d.resultMut.Lock()
	for _, res := range results {
		delete(d.resultMap, res)
	}
	d.resultMut.Unlock()

	return err
}

func (d *DriverImpl) StmtNumInput(stID string) int {
	d.stMut.Lock()
	defer d.stMut.Unlock()
	return d.stMap[stID].stmt.NumInput()
}

func (d *DriverImpl) StmtQuery(stID string, args []driver.NamedValue) (string, error) {
	argVals := make([]driver.Value, len(args))
	for i, a := range args {
		argVals[i] = a.Value
	}
	d.stMut.Lock()
	rows, err := d.stMap[stID].stmt.Query(argVals) //nolint:staticcheck
	d.stMut.Unlock()
	if err != nil {
		return "", err
	}
	rowsID := model.NewId()
	d.rowsMut.Lock()
	d.rowsMap[rowsID] = rows
	d.rowsMut.Unlock()
	return rowsID, nil
}

func (d *DriverImpl) StmtExec(stID string, args []driver.NamedValue) (string, error) {
	argVals := make([]driver.Value, len(args))
	for i, a := range args {
		argVals[i] = a.Value
	}
	d.stMut.Lock()
	res, err := d.stMap[stID].stmt.Exec(argVals) //nolint:staticcheck
	d.stMut.Unlock()
	if err != nil {
		return "", err
	}
	resID := model.NewId()
	d.stMut.Lock()
	d.stMap[stID].results = append(d.stMap[stID].results, resID)
	d.stMut.Unlock()

	d.resultMut.Lock()
	d.resultMap[resID] = res
	d.resultMut.Unlock()

	return resID, nil
}

func (d *DriverImpl) ResultLastInsertID(resID string) (int64, error) {
	d.resultMut.Lock()
	defer d.resultMut.Unlock()
	return d.resultMap[resID].LastInsertId()
}

func (d *DriverImpl) ResultRowsAffected(resID string) (int64, error) {
	d.resultMut.Lock()
	defer d.resultMut.Unlock()
	return d.resultMap[resID].RowsAffected()
}

func (d *DriverImpl) RowsColumns(rowsID string) []string {
	d.rowsMut.Lock()
	defer d.rowsMut.Unlock()
	return d.rowsMap[rowsID].Columns()
}

func (d *DriverImpl) RowsClose(rowsID string) error {
	d.rowsMut.Lock()
	defer d.rowsMut.Unlock()
	err := d.rowsMap[rowsID].Close()
	delete(d.rowsMap, rowsID)
	return err
}

func (d *DriverImpl) RowsNext(rowsID string, dest []driver.Value) error {
	d.rowsMut.Lock()
	defer d.rowsMut.Unlock()
	return d.rowsMap[rowsID].Next(dest)
}

func (d *DriverImpl) RowsHasNextResultSet(rowsID string) bool {
	d.rowsMut.Lock()
	defer d.rowsMut.Unlock()
	return d.rowsMap[rowsID].(driver.RowsNextResultSet).HasNextResultSet()
}

func (d *DriverImpl) RowsNextResultSet(rowsID string) error {
	d.rowsMut.Lock()
	defer d.rowsMut.Unlock()
	return d.rowsMap[rowsID].(driver.RowsNextResultSet).NextResultSet()
}

func (d *DriverImpl) RowsColumnTypeDatabaseTypeName(rowsID string, index int) string {
	d.rowsMut.Lock()
	defer d.rowsMut.Unlock()
	return d.rowsMap[rowsID].(driver.RowsColumnTypeDatabaseTypeName).ColumnTypeDatabaseTypeName(index)
}

func (d *DriverImpl) RowsColumnTypePrecisionScale(rowsID string, index int) (int64, int64, bool) {
	d.rowsMut.Lock()
	defer d.rowsMut.Unlock()
	return d.rowsMap[rowsID].(driver.RowsColumnTypePrecisionScale).ColumnTypePrecisionScale(index)
}
