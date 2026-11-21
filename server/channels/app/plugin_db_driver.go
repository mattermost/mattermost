// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"io"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// DriverImpl implements the plugin.Driver interface on the server-side.
// Each new request for a connection/statement/transaction etc, generates
// a new entry tracked centrally in a map. Further requests operate on the
// object ID.
//
// Every statement a plugin runs is bounded by SqlSettings.QueryTimeout, the
// same limit applied to the server's own queries. For queries, the bound
// starts when the query is issued and lasts until RowsClose, so a result set
// read slowly enough is cut off too. For prepared statements, lib/pq only
// cancels the query on the server: rows already received can still be read.
// Transactions as a whole are not bounded, but each statement within them is.
type DriverImpl struct {
	s       *Server
	connMut sync.RWMutex
	connMap map[string]*connMeta
	txMut   sync.Mutex
	txMap   map[string]*txMeta
	stMut   sync.RWMutex
	stMap   map[string]*stmtMeta
	rowsMut sync.RWMutex
	rowsMap map[string]*rowsMeta
}

type connMeta struct {
	pluginID string
	conn     *sql.Conn
}

type txMeta struct {
	connID string
	tx     driver.Tx
}

type stmtMeta struct {
	connID   string
	pluginID string
	stmt     driver.Stmt
}

type rowsMeta struct {
	connID   string
	pluginID string
	rows     driver.Rows
	ctx      context.Context
	cancel   context.CancelFunc
}

// connObjects are the rows, statements and transactions still open on a
// connection when it is closed.
type connObjects struct {
	rows  []*rowsMeta
	stmts []*stmtMeta
	txs   []*txMeta
}

func NewDriverImpl(s *Server) *DriverImpl {
	return &DriverImpl{
		s:       s,
		connMap: make(map[string]*connMeta),
		txMap:   make(map[string]*txMeta),
		stMap:   make(map[string]*stmtMeta),
		rowsMap: make(map[string]*rowsMeta),
	}
}

func (d *DriverImpl) queryContext() (context.Context, context.CancelFunc) {
	timeout := time.Duration(*d.s.Config().SqlSettings.QueryTimeout) * time.Second
	return context.WithTimeout(context.Background(), timeout)
}

func (d *DriverImpl) logIfTimedOut(ctx context.Context, err error, pluginID, op string) {
	if err == nil || !errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return
	}
	d.s.Log().Warn("Plugin database operation exceeded the query timeout and was cancelled",
		mlog.String("plugin_id", pluginID),
		mlog.String("operation", op),
		mlog.Int("query_timeout_seconds", *d.s.Config().SqlSettings.QueryTimeout),
		mlog.Err(err),
	)
}

func (d *DriverImpl) Conn(isMaster bool) (string, error) {
	return d.conn(isMaster, "")
}

func (d *DriverImpl) ConnWithPluginID(isMaster bool, pluginID string) (string, error) {
	return d.conn(isMaster, pluginID)
}

func (d *DriverImpl) conn(isMaster bool, pluginID string) (string, error) {
	dbFunc := d.s.Platform().Store.GetInternalMasterDB
	if !isMaster {
		dbFunc = d.s.Platform().Store.GetInternalReplicaDB
	}
	ctx, cancel := d.queryContext()
	defer cancel()
	conn, err := dbFunc().Conn(ctx)
	if err != nil {
		return "", err
	}
	connID := model.NewId()
	d.connMut.Lock()
	d.connMap[connID] = &connMeta{pluginID: pluginID, conn: conn}
	d.connMut.Unlock()
	return connID, nil
}

// According to https://golang.org/pkg/database/sql/#Conn, a client can call
// Close on a connection, concurrently while running a query.
//
// Therefore, we have to handle the case where the connection is no longer
// present in the map because it has been closed. ErrBadConn is a good choice
// here which indicates the sql package to retry on a new connection.
//
// ConnPing, ConnQuery, ConnClose, Tx, and Stmt do this.

func (d *DriverImpl) ConnPing(connID string) error {
	d.connMut.RLock()
	entry, ok := d.connMap[connID]
	d.connMut.RUnlock()
	if !ok {
		return driver.ErrBadConn
	}

	ctx, cancel := d.queryContext()
	defer cancel()
	err := entry.conn.Raw(func(innerConn any) error {
		return innerConn.(driver.Pinger).Ping(ctx)
	})
	d.logIfTimedOut(ctx, err, entry.pluginID, "ConnPing")
	return err
}

func (d *DriverImpl) ConnQuery(connID, q string, args []driver.NamedValue) (_ string, err error) {
	var rows driver.Rows
	d.connMut.RLock()
	entry, ok := d.connMap[connID]
	d.connMut.RUnlock()
	if !ok {
		return "", driver.ErrBadConn
	}

	ctx, cancel := d.queryContext()
	err = entry.conn.Raw(func(innerConn any) error {
		rows, err = innerConn.(driver.QueryerContext).QueryContext(ctx, q, args)
		return err
	})
	if err != nil {
		d.logIfTimedOut(ctx, err, entry.pluginID, "ConnQuery")
		cancel()
		return "", err
	}

	return d.addRows(ctx, cancel, connID, entry.pluginID, rows), nil
}

func (d *DriverImpl) ConnExec(connID, q string, args []driver.NamedValue) (_ plugin.ResultContainer, err error) {
	var res driver.Result
	var ret plugin.ResultContainer
	d.connMut.RLock()
	entry, ok := d.connMap[connID]
	d.connMut.RUnlock()
	if !ok {
		return ret, driver.ErrBadConn
	}

	ctx, cancel := d.queryContext()
	defer cancel()
	err = entry.conn.Raw(func(innerConn any) error {
		res, err = innerConn.(driver.ExecerContext).ExecContext(ctx, q, args)
		return err
	})
	if err != nil {
		d.logIfTimedOut(ctx, err, entry.pluginID, "ConnExec")
		return ret, err
	}

	ret.LastID, ret.LastIDError = res.LastInsertId()
	ret.RowsAffected, ret.RowsAffectedError = res.RowsAffected()

	return ret, nil
}

func (d *DriverImpl) ConnClose(connID string) error {
	d.connMut.Lock()
	entry, ok := d.connMap[connID]
	if !ok {
		d.connMut.Unlock()
		return driver.ErrBadConn
	}
	delete(d.connMap, connID)
	d.connMut.Unlock()

	return d.closeConn(connID, entry)
}

// ShutdownConns will close any remaining connections for the given pluginID
// if they weren't already closed by the plugin itself.
func (d *DriverImpl) ShutdownConns(pluginID string) {
	conns := make(map[string]*connMeta)
	d.connMut.Lock()
	for connID, entry := range d.connMap {
		if entry.pluginID == pluginID {
			conns[connID] = entry
			delete(d.connMap, connID)
		}
	}
	d.connMut.Unlock()

	for connID, entry := range conns {
		if err := d.closeConn(connID, entry); err != nil {
			d.s.Log().Error("Error while closing DB connection", mlog.Err(err), mlog.String("plugin_id", pluginID))
		}
	}
}

// closeConn releases any rows, statements and transactions still open on the
// connection, so it goes back to the pool idle, and then closes it. The
// connection must already be removed from connMap.
func (d *DriverImpl) closeConn(connID string, entry *connMeta) error {
	objs := d.takeConnObjects(connID)

	for _, r := range objs.rows {
		// Cancel first so Close does not wait to drain a slow result set.
		r.cancel()
		if err := r.rows.Close(); err != nil {
			d.s.Log().Warn("Error while closing DB rows", mlog.Err(err), mlog.String("plugin_id", entry.pluginID))
		}
	}
	for _, st := range objs.stmts {
		if err := st.stmt.Close(); err != nil {
			d.s.Log().Warn("Error while closing DB statement", mlog.Err(err), mlog.String("plugin_id", entry.pluginID))
		}
	}
	for _, tx := range objs.txs {
		if err := tx.tx.Rollback(); err != nil {
			d.s.Log().Warn("Error while rolling back DB transaction", mlog.Err(err), mlog.String("plugin_id", entry.pluginID))
		}
	}

	return entry.conn.Close()
}

func (d *DriverImpl) takeConnObjects(connID string) connObjects {
	var objs connObjects

	d.rowsMut.Lock()
	for rowsID, r := range d.rowsMap {
		if r.connID == connID {
			objs.rows = append(objs.rows, r)
			delete(d.rowsMap, rowsID)
		}
	}
	d.rowsMut.Unlock()

	d.stMut.Lock()
	for stID, st := range d.stMap {
		if st.connID == connID {
			objs.stmts = append(objs.stmts, st)
			delete(d.stMap, stID)
		}
	}
	d.stMut.Unlock()

	d.txMut.Lock()
	for txID, tx := range d.txMap {
		if tx.connID == connID {
			objs.txs = append(objs.txs, tx)
			delete(d.txMap, txID)
		}
	}
	d.txMut.Unlock()

	return objs
}

func (d *DriverImpl) Tx(connID string, opts driver.TxOptions) (_ string, err error) {
	var tx driver.Tx
	d.connMut.RLock()
	entry, ok := d.connMap[connID]
	d.connMut.RUnlock()
	if !ok {
		return "", driver.ErrBadConn
	}

	err = entry.conn.Raw(func(innerConn any) error {
		tx, err = innerConn.(driver.ConnBeginTx).BeginTx(context.Background(), opts)
		return err
	})
	if err != nil {
		return "", err
	}

	txID := model.NewId()
	d.txMut.Lock()
	d.txMap[txID] = &txMeta{connID: connID, tx: tx}
	d.txMut.Unlock()
	return txID, nil
}

func (d *DriverImpl) takeTx(txID string) (driver.Tx, error) {
	d.txMut.Lock()
	defer d.txMut.Unlock()
	entry, ok := d.txMap[txID]
	if !ok {
		return nil, driver.ErrBadConn
	}
	delete(d.txMap, txID)
	return entry.tx, nil
}

func (d *DriverImpl) TxCommit(txID string) error {
	tx, err := d.takeTx(txID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (d *DriverImpl) TxRollback(txID string) error {
	tx, err := d.takeTx(txID)
	if err != nil {
		return err
	}
	return tx.Rollback()
}

func (d *DriverImpl) Stmt(connID, q string) (_ string, err error) {
	var stmt driver.Stmt
	d.connMut.RLock()
	entry, ok := d.connMap[connID]
	d.connMut.RUnlock()
	if !ok {
		return "", driver.ErrBadConn
	}

	ctx, cancel := d.queryContext()
	defer cancel()
	err = entry.conn.Raw(func(innerConn any) error {
		stmt, err = innerConn.(driver.ConnPrepareContext).PrepareContext(ctx, q)
		return err
	})
	if err != nil {
		d.logIfTimedOut(ctx, err, entry.pluginID, "Stmt")
		return "", err
	}

	stID := model.NewId()
	d.stMut.Lock()
	d.stMap[stID] = &stmtMeta{connID: connID, pluginID: entry.pluginID, stmt: stmt}
	d.stMut.Unlock()
	return stID, nil
}

func (d *DriverImpl) StmtClose(stID string) error {
	d.stMut.Lock()
	entry, ok := d.stMap[stID]
	delete(d.stMap, stID)
	d.stMut.Unlock()
	if !ok {
		return driver.ErrBadConn
	}

	return entry.stmt.Close()
}

// StmtNumInput returns -1 for an unknown statement, which tells database/sql
// to skip its argument count check and let the subsequent call fail.
func (d *DriverImpl) StmtNumInput(stID string) int {
	entry, err := d.getStmt(stID)
	if err != nil {
		return -1
	}
	return entry.stmt.NumInput()
}

func (d *DriverImpl) getStmt(stID string) (*stmtMeta, error) {
	d.stMut.RLock()
	defer d.stMut.RUnlock()
	entry, ok := d.stMap[stID]
	if !ok {
		return nil, driver.ErrBadConn
	}
	return entry, nil
}

func (d *DriverImpl) StmtQuery(stID string, args []driver.NamedValue) (string, error) {
	entry, err := d.getStmt(stID)
	if err != nil {
		return "", err
	}

	ctx, cancel := d.queryContext()
	rows, err := entry.stmt.(driver.StmtQueryContext).QueryContext(ctx, args)
	if err != nil {
		d.logIfTimedOut(ctx, err, entry.pluginID, "StmtQuery")
		cancel()
		return "", err
	}

	return d.addRows(ctx, cancel, entry.connID, entry.pluginID, rows), nil
}

func (d *DriverImpl) StmtExec(stID string, args []driver.NamedValue) (plugin.ResultContainer, error) {
	var ret plugin.ResultContainer
	entry, err := d.getStmt(stID)
	if err != nil {
		return ret, err
	}

	ctx, cancel := d.queryContext()
	defer cancel()
	res, err := entry.stmt.(driver.StmtExecContext).ExecContext(ctx, args)
	if err != nil {
		d.logIfTimedOut(ctx, err, entry.pluginID, "StmtExec")
		return ret, err
	}

	ret.LastID, ret.LastIDError = res.LastInsertId()
	ret.RowsAffected, ret.RowsAffectedError = res.RowsAffected()

	return ret, nil
}

func (d *DriverImpl) addRows(ctx context.Context, cancel context.CancelFunc, connID, pluginID string, rows driver.Rows) string {
	rowsID := model.NewId()
	d.rowsMut.Lock()
	d.rowsMap[rowsID] = &rowsMeta{connID: connID, pluginID: pluginID, rows: rows, ctx: ctx, cancel: cancel}
	d.rowsMut.Unlock()
	return rowsID
}

func (d *DriverImpl) getRows(rowsID string) (*rowsMeta, error) {
	d.rowsMut.RLock()
	defer d.rowsMut.RUnlock()
	entry, ok := d.rowsMap[rowsID]
	if !ok {
		return nil, driver.ErrBadConn
	}
	return entry, nil
}

func (d *DriverImpl) RowsColumns(rowsID string) []string {
	entry, err := d.getRows(rowsID)
	if err != nil {
		return nil
	}
	return entry.rows.Columns()
}

func (d *DriverImpl) RowsClose(rowsID string) error {
	d.rowsMut.Lock()
	entry, ok := d.rowsMap[rowsID]
	delete(d.rowsMap, rowsID)
	d.rowsMut.Unlock()
	if !ok {
		return driver.ErrBadConn
	}

	defer entry.cancel()
	return entry.rows.Close()
}

func (d *DriverImpl) RowsNext(rowsID string, dest []driver.Value) error {
	entry, err := d.getRows(rowsID)
	if err != nil {
		return err
	}
	err = entry.rows.Next(dest)
	if err != io.EOF {
		d.logIfTimedOut(entry.ctx, err, entry.pluginID, "RowsNext")
	}
	return err
}

func (d *DriverImpl) RowsHasNextResultSet(rowsID string) bool {
	entry, err := d.getRows(rowsID)
	if err != nil {
		return false
	}
	return entry.rows.(driver.RowsNextResultSet).HasNextResultSet()
}

func (d *DriverImpl) RowsNextResultSet(rowsID string) error {
	entry, err := d.getRows(rowsID)
	if err != nil {
		return err
	}
	return entry.rows.(driver.RowsNextResultSet).NextResultSet()
}

func (d *DriverImpl) RowsColumnTypeDatabaseTypeName(rowsID string, index int) string {
	entry, err := d.getRows(rowsID)
	if err != nil {
		return ""
	}
	return entry.rows.(driver.RowsColumnTypeDatabaseTypeName).ColumnTypeDatabaseTypeName(index)
}

func (d *DriverImpl) RowsColumnTypePrecisionScale(rowsID string, index int) (int64, int64, bool) {
	entry, err := d.getRows(rowsID)
	if err != nil {
		return 0, 0, false
	}
	return entry.rows.(driver.RowsColumnTypePrecisionScale).ColumnTypePrecisionScale(index)
}
