// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"database/sql"
	"database/sql/driver"
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
type DriverImpl struct {
	s       *Server
	connMut sync.RWMutex
	connMap map[string]*connMeta
	txMut   sync.Mutex
	txMap   map[string]driver.Tx
	stMut   sync.RWMutex
	stMap   map[string]driver.Stmt
	rowsMut sync.RWMutex
	rowsMap map[string]driver.Rows
}

type connMeta struct {
	pluginID string
	conn     *sql.Conn
}

func NewDriverImpl(s *Server) *DriverImpl {
	return &DriverImpl{
		s:       s,
		connMap: make(map[string]*connMeta),
		txMap:   make(map[string]driver.Tx),
		stMap:   make(map[string]driver.Stmt),
		rowsMap: make(map[string]driver.Rows),
	}
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
	timeout := time.Duration(*d.s.Config().SqlSettings.QueryTimeout) * time.Second
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
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

	return entry.conn.Raw(func(innerConn any) error {
		return innerConn.(driver.Pinger).Ping(context.Background())
	})
}

func (d *DriverImpl) ConnQuery(connID, q string, args []driver.NamedValue) (_ string, err error) {
	var rows driver.Rows
	d.connMut.RLock()
	entry, ok := d.connMap[connID]
	d.connMut.RUnlock()
	if !ok {
		return "", driver.ErrBadConn
	}

	err = entry.conn.Raw(func(innerConn any) error {
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

func (d *DriverImpl) ConnExec(connID, q string, args []driver.NamedValue) (_ plugin.ResultContainer, err error) {
	var res driver.Result
	var ret plugin.ResultContainer
	d.connMut.RLock()
	entry, ok := d.connMap[connID]
	d.connMut.RUnlock()
	if !ok {
		return ret, driver.ErrBadConn
	}

	err = entry.conn.Raw(func(innerConn any) error {
		res, err = innerConn.(driver.ExecerContext).ExecContext(context.Background(), q, args)
		return err
	})
	if err != nil {
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

	return entry.conn.Close()
}

// ShutdownConns will close any remaining connections for the given pluginID
// if they weren't already closed by the plugin itself.
func (d *DriverImpl) ShutdownConns(pluginID string) {
	d.connMut.Lock()
	defer d.connMut.Unlock()
	for connID, entry := range d.connMap {
		if entry.pluginID == pluginID {
			err := entry.conn.Close()
			if err != nil {
				d.s.Log().Error("Error while closing DB connection", mlog.Err(err), mlog.String("pluginID", pluginID))
			}
			delete(d.connMap, connID)
		}
	}
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
	d.txMap[txID] = tx
	d.txMut.Unlock()
	return txID, nil
}

func (d *DriverImpl) TxCommit(txID string) error {
	d.txMut.Lock()
	tx := d.txMap[txID]
	delete(d.txMap, txID)
	d.txMut.Unlock()

	return tx.Commit()
}

func (d *DriverImpl) TxRollback(txID string) error {
	d.txMut.Lock()
	tx := d.txMap[txID]
	delete(d.txMap, txID)
	d.txMut.Unlock()

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

	err = entry.conn.Raw(func(innerConn any) error {
		stmt, err = innerConn.(driver.Conn).Prepare(q)
		return err
	})
	if err != nil {
		return "", err
	}

	stID := model.NewId()
	d.stMut.Lock()
	d.stMap[stID] = stmt
	d.stMut.Unlock()
	return stID, nil
}

func (d *DriverImpl) StmtClose(stID string) error {
	d.stMut.Lock()
	err := d.stMap[stID].Close()
	delete(d.stMap, stID)
	d.stMut.Unlock()

	return err
}

func (d *DriverImpl) StmtNumInput(stID string) int {
	d.stMut.RLock()
	defer d.stMut.RUnlock()
	return d.stMap[stID].NumInput()
}

func (d *DriverImpl) StmtQuery(stID string, args []driver.NamedValue) (string, error) {
	argVals := make([]driver.Value, len(args))
	for i, a := range args {
		argVals[i] = a.Value
	}
	d.stMut.RLock()
	st := d.stMap[stID]
	d.stMut.RUnlock()

	rows, err := st.Query(argVals) //nolint:staticcheck
	if err != nil {
		return "", err
	}
	rowsID := model.NewId()
	d.rowsMut.Lock()
	d.rowsMap[rowsID] = rows
	d.rowsMut.Unlock()
	return rowsID, nil
}

func (d *DriverImpl) StmtExec(stID string, args []driver.NamedValue) (plugin.ResultContainer, error) {
	argVals := make([]driver.Value, len(args))
	for i, a := range args {
		argVals[i] = a.Value
	}
	var ret plugin.ResultContainer
	d.stMut.RLock()
	st := d.stMap[stID]
	d.stMut.RUnlock()

	res, err := st.Exec(argVals) //nolint:staticcheck
	if err != nil {
		return ret, err
	}

	ret.LastID, ret.LastIDError = res.LastInsertId()
	ret.RowsAffected, ret.RowsAffectedError = res.RowsAffected()

	return ret, nil
}

func (d *DriverImpl) RowsColumns(rowsID string) []string {
	d.rowsMut.RLock()
	defer d.rowsMut.RUnlock()
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
	d.rowsMut.RLock()
	rows := d.rowsMap[rowsID]
	d.rowsMut.RUnlock()
	return rows.Next(dest)
}

func (d *DriverImpl) RowsHasNextResultSet(rowsID string) bool {
	d.rowsMut.RLock()
	defer d.rowsMut.RUnlock()
	return d.rowsMap[rowsID].(driver.RowsNextResultSet).HasNextResultSet()
}

func (d *DriverImpl) RowsNextResultSet(rowsID string) error {
	d.rowsMut.RLock()
	defer d.rowsMut.RUnlock()
	return d.rowsMap[rowsID].(driver.RowsNextResultSet).NextResultSet()
}

func (d *DriverImpl) RowsColumnTypeDatabaseTypeName(rowsID string, index int) string {
	d.rowsMut.RLock()
	defer d.rowsMut.RUnlock()
	return d.rowsMap[rowsID].(driver.RowsColumnTypeDatabaseTypeName).ColumnTypeDatabaseTypeName(index)
}

func (d *DriverImpl) RowsColumnTypePrecisionScale(rowsID string, index int) (int64, int64, bool) {
	d.rowsMut.RLock()
	defer d.rowsMut.RUnlock()
	return d.rowsMap[rowsID].(driver.RowsColumnTypePrecisionScale).ColumnTypePrecisionScale(index)
}
