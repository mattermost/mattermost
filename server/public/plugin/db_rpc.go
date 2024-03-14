// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

import (
	"database/sql/driver"
	"log"
	"net/rpc"
)

// dbRPCClient contains the client-side logic to handle the RPC communication
// with the server. It's API is hand-written because we do not expect
// new methods to be added very frequently.
type dbRPCClient struct {
	client *rpc.Client
}

// dbRPCServer is the server-side component which is responsible for calling
// the driver methods and properly encoding the responses back to the RPC client.
type dbRPCServer struct {
	dbImpl Driver
}

var _ Driver = &dbRPCClient{}

type Z_DbStrErrReturn struct {
	A string
	B error
}

type Z_DbErrReturn struct {
	A error
}

type Z_DbInt64ErrReturn struct {
	A int64
	B error
}

type Z_DbBoolReturn struct {
	A bool
}

func (db *dbRPCClient) Conn(isMaster bool) (string, error) {
	ret := &Z_DbStrErrReturn{}
	err := db.client.Call("Plugin.Conn", isMaster, ret)
	if err != nil {
		log.Printf("error during Plugin.Conn: %v", err)
	}
	ret.B = decodableError(ret.B)
	return ret.A, ret.B
}

func (db *dbRPCServer) Conn(isMaster bool, ret *Z_DbStrErrReturn) error {
	ret.A, ret.B = db.dbImpl.Conn(isMaster)
	ret.B = encodableError(ret.B)
	return nil
}

func (db *dbRPCClient) ConnPing(connID string) error {
	ret := &Z_DbErrReturn{}
	err := db.client.Call("Plugin.ConnPing", connID, ret)
	if err != nil {
		log.Printf("error during Plugin.ConnPing: %v", err)
	}
	ret.A = decodableError(ret.A)
	return ret.A
}

func (db *dbRPCServer) ConnPing(connID string, ret *Z_DbErrReturn) error {
	ret.A = db.dbImpl.ConnPing(connID)
	ret.A = encodableError(ret.A)
	return nil
}

func (db *dbRPCClient) ConnClose(connID string) error {
	ret := &Z_DbErrReturn{}
	err := db.client.Call("Plugin.ConnClose", connID, ret)
	if err != nil {
		log.Printf("error during Plugin.ConnClose: %v", err)
	}
	ret.A = decodableError(ret.A)
	return ret.A
}

func (db *dbRPCServer) ConnClose(connID string, ret *Z_DbErrReturn) error {
	ret.A = db.dbImpl.ConnClose(connID)
	ret.A = encodableError(ret.A)
	return nil
}

type Z_DbTxArgs struct {
	A string
	B driver.TxOptions
}

func (db *dbRPCClient) Tx(connID string, opts driver.TxOptions) (string, error) {
	args := &Z_DbTxArgs{
		A: connID,
		B: opts,
	}
	ret := &Z_DbStrErrReturn{}
	err := db.client.Call("Plugin.Tx", args, ret)
	if err != nil {
		log.Printf("error during Plugin.Tx: %v", err)
	}
	ret.B = decodableError(ret.B)
	return ret.A, ret.B
}

func (db *dbRPCServer) Tx(args *Z_DbTxArgs, ret *Z_DbStrErrReturn) error {
	ret.A, ret.B = db.dbImpl.Tx(args.A, args.B)
	ret.B = encodableError(ret.B)
	return nil
}

func (db *dbRPCClient) TxCommit(txID string) error {
	ret := &Z_DbErrReturn{}
	err := db.client.Call("Plugin.TxCommit", txID, ret)
	if err != nil {
		log.Printf("error during Plugin.TxCommit: %v", err)
	}
	ret.A = decodableError(ret.A)
	return ret.A
}

func (db *dbRPCServer) TxCommit(txID string, ret *Z_DbErrReturn) error {
	ret.A = db.dbImpl.TxCommit(txID)
	ret.A = encodableError(ret.A)
	return nil
}

func (db *dbRPCClient) TxRollback(txID string) error {
	ret := &Z_DbErrReturn{}
	err := db.client.Call("Plugin.TxRollback", txID, ret)
	if err != nil {
		log.Printf("error during Plugin.TxRollback: %v", err)
	}
	ret.A = decodableError(ret.A)
	return ret.A
}

func (db *dbRPCServer) TxRollback(txID string, ret *Z_DbErrReturn) error {
	ret.A = db.dbImpl.TxRollback(txID)
	ret.A = encodableError(ret.A)
	return nil
}

type Z_DbStmtArgs struct {
	A string
	B string
}

func (db *dbRPCClient) Stmt(connID, q string) (string, error) {
	args := &Z_DbStmtArgs{
		A: connID,
		B: q,
	}
	ret := &Z_DbStrErrReturn{}
	err := db.client.Call("Plugin.Stmt", args, ret)
	if err != nil {
		log.Printf("error during Plugin.Stmt: %v", err)
	}
	ret.B = decodableError(ret.B)
	return ret.A, ret.B
}

func (db *dbRPCServer) Stmt(args *Z_DbStmtArgs, ret *Z_DbStrErrReturn) error {
	ret.A, ret.B = db.dbImpl.Stmt(args.A, args.B)
	ret.B = encodableError(ret.B)
	return nil
}

func (db *dbRPCClient) StmtClose(stID string) error {
	ret := &Z_DbErrReturn{}
	err := db.client.Call("Plugin.StmtClose", stID, ret)
	if err != nil {
		log.Printf("error during Plugin.StmtClose: %v", err)
	}
	ret.A = decodableError(ret.A)
	return ret.A
}

func (db *dbRPCServer) StmtClose(stID string, ret *Z_DbErrReturn) error {
	ret.A = db.dbImpl.StmtClose(stID)
	ret.A = encodableError(ret.A)
	return nil
}

type Z_DbIntReturn struct {
	A int
}

func (db *dbRPCClient) StmtNumInput(stID string) int {
	ret := &Z_DbIntReturn{}
	err := db.client.Call("Plugin.StmtNumInput", stID, ret)
	if err != nil {
		log.Printf("error during Plugin.StmtNumInput: %v", err)
	}
	return ret.A
}

func (db *dbRPCServer) StmtNumInput(stID string, ret *Z_DbIntReturn) error {
	ret.A = db.dbImpl.StmtNumInput(stID)
	return nil
}

type Z_DbStmtQueryArgs struct {
	A string
	B []driver.NamedValue
}

func (db *dbRPCClient) StmtQuery(stID string, argVals []driver.NamedValue) (string, error) {
	args := &Z_DbStmtQueryArgs{
		A: stID,
		B: argVals,
	}
	ret := &Z_DbStrErrReturn{}
	err := db.client.Call("Plugin.StmtQuery", args, ret)
	if err != nil {
		log.Printf("error during Plugin.StmtQuery: %v", err)
	}
	ret.B = decodableError(ret.B)
	return ret.A, ret.B
}

func (db *dbRPCServer) StmtQuery(args *Z_DbStmtQueryArgs, ret *Z_DbStrErrReturn) error {
	ret.A, ret.B = db.dbImpl.StmtQuery(args.A, args.B)
	ret.B = encodableError(ret.B)
	return nil
}

func (db *dbRPCClient) StmtExec(stID string, argVals []driver.NamedValue) (ResultContainer, error) {
	args := &Z_DbStmtQueryArgs{
		A: stID,
		B: argVals,
	}
	ret := &Z_DbResultContErrReturn{}
	err := db.client.Call("Plugin.StmtExec", args, ret)
	if err != nil {
		log.Printf("error during Plugin.StmtExec: %v", err)
	}
	ret.A.LastIDError = decodableError(ret.A.LastIDError)
	ret.A.RowsAffectedError = decodableError(ret.A.RowsAffectedError)
	ret.B = decodableError(ret.B)
	return ret.A, ret.B
}

func (db *dbRPCServer) StmtExec(args *Z_DbStmtQueryArgs, ret *Z_DbResultContErrReturn) error {
	ret.A, ret.B = db.dbImpl.StmtExec(args.A, args.B)
	ret.A.LastIDError = encodableError(ret.A.LastIDError)
	ret.A.RowsAffectedError = encodableError(ret.A.RowsAffectedError)
	ret.B = encodableError(ret.B)
	return nil
}

type Z_DbConnArgs struct {
	A string
	B string
	C []driver.NamedValue
}

func (db *dbRPCClient) ConnQuery(connID, q string, argVals []driver.NamedValue) (string, error) {
	args := &Z_DbConnArgs{
		A: connID,
		B: q,
		C: argVals,
	}
	ret := &Z_DbStrErrReturn{}
	err := db.client.Call("Plugin.ConnQuery", args, ret)
	if err != nil {
		log.Printf("error during Plugin.ConnQuery: %v", err)
	}
	ret.B = decodableError(ret.B)
	return ret.A, ret.B
}

func (db *dbRPCServer) ConnQuery(args *Z_DbConnArgs, ret *Z_DbStrErrReturn) error {
	ret.A, ret.B = db.dbImpl.ConnQuery(args.A, args.B, args.C)
	ret.B = encodableError(ret.B)
	return nil
}

type Z_DbResultContErrReturn struct {
	A ResultContainer
	B error
}

func (db *dbRPCClient) ConnExec(connID, q string, argVals []driver.NamedValue) (ResultContainer, error) {
	args := &Z_DbConnArgs{
		A: connID,
		B: q,
		C: argVals,
	}
	ret := &Z_DbResultContErrReturn{}
	err := db.client.Call("Plugin.ConnExec", args, ret)
	if err != nil {
		log.Printf("error during Plugin.ConnExec: %v", err)
	}
	ret.A.LastIDError = decodableError(ret.A.LastIDError)
	ret.A.RowsAffectedError = decodableError(ret.A.RowsAffectedError)
	ret.B = decodableError(ret.B)
	return ret.A, ret.B
}

func (db *dbRPCServer) ConnExec(args *Z_DbConnArgs, ret *Z_DbResultContErrReturn) error {
	ret.A, ret.B = db.dbImpl.ConnExec(args.A, args.B, args.C)
	ret.A.LastIDError = encodableError(ret.A.LastIDError)
	ret.A.RowsAffectedError = encodableError(ret.A.RowsAffectedError)
	ret.B = encodableError(ret.B)
	return nil
}

type Z_DbStrSliceReturn struct {
	A []string
}

func (db *dbRPCClient) RowsColumns(rowsID string) []string {
	ret := &Z_DbStrSliceReturn{}
	err := db.client.Call("Plugin.RowsColumns", rowsID, ret)
	if err != nil {
		log.Printf("error during Plugin.RowsColumns: %v", err)
	}
	return ret.A
}

func (db *dbRPCServer) RowsColumns(rowsID string, ret *Z_DbStrSliceReturn) error {
	ret.A = db.dbImpl.RowsColumns(rowsID)
	return nil
}

func (db *dbRPCClient) RowsClose(resID string) error {
	ret := &Z_DbErrReturn{}
	err := db.client.Call("Plugin.RowsClose", resID, ret)
	if err != nil {
		log.Printf("error during Plugin.RowsClose: %v", err)
	}
	ret.A = decodableError(ret.A)
	return ret.A
}

func (db *dbRPCServer) RowsClose(resID string, ret *Z_DbErrReturn) error {
	ret.A = db.dbImpl.RowsClose(resID)
	ret.A = encodableError(ret.A)
	return nil
}

type Z_DbRowScanReturn struct {
	A error
	B []driver.Value
}

type Z_DbRowScanArg struct {
	A string
	B []driver.Value
}

func (db *dbRPCClient) RowsNext(rowsID string, dest []driver.Value) error {
	args := &Z_DbRowScanArg{
		A: rowsID,
		B: dest,
	}
	ret := &Z_DbRowScanReturn{}
	err := db.client.Call("Plugin.RowsNext", args, ret)
	if err != nil {
		log.Printf("error during Plugin.RowsNext: %v", err)
	}
	ret.A = decodableError(ret.A)
	copy(dest, ret.B)
	return ret.A
}

func (db *dbRPCServer) RowsNext(args *Z_DbRowScanArg, ret *Z_DbRowScanReturn) error {
	ret.A = db.dbImpl.RowsNext(args.A, args.B)
	ret.A = encodableError(ret.A)
	// Trick to populate the dest slice. RPC doesn't have a semantic to populate
	// pointer type args. So the only way to pass values is via args, and only way
	// to return values is via the return struct.
	ret.B = args.B
	return nil
}

func (db *dbRPCClient) RowsHasNextResultSet(rowsID string) bool {
	ret := &Z_DbBoolReturn{}
	err := db.client.Call("Plugin.RowsHasNextResultSet", rowsID, ret)
	if err != nil {
		log.Printf("error during Plugin.RowsHasNextResultSet: %v", err)
	}
	return ret.A
}

func (db *dbRPCServer) RowsHasNextResultSet(rowsID string, ret *Z_DbBoolReturn) error {
	ret.A = db.dbImpl.RowsHasNextResultSet(rowsID)
	return nil
}

func (db *dbRPCClient) RowsNextResultSet(rowsID string) error {
	ret := &Z_DbErrReturn{}
	err := db.client.Call("Plugin.RowsNextResultSet", rowsID, ret)
	if err != nil {
		log.Printf("error during Plugin.RowsNextResultSet: %v", err)
	}
	ret.A = decodableError(ret.A)
	return ret.A
}

func (db *dbRPCServer) RowsNextResultSet(rowsID string, ret *Z_DbErrReturn) error {
	ret.A = db.dbImpl.RowsNextResultSet(rowsID)
	ret.A = encodableError(ret.A)
	return nil
}

type Z_DbRowsColumnArg struct {
	A string
	B int
}

func (db *dbRPCClient) RowsColumnTypeDatabaseTypeName(rowsID string, index int) string {
	args := &Z_DbRowsColumnArg{
		A: rowsID,
		B: index,
	}
	var ret string
	err := db.client.Call("Plugin.RowsColumnTypeDatabaseTypeName", args, &ret)
	if err != nil {
		log.Printf("error during Plugin.RowsColumnTypeDatabaseTypeName: %v", err)
	}
	return ret
}

func (db *dbRPCServer) RowsColumnTypeDatabaseTypeName(args *Z_DbRowsColumnArg, ret *string) error {
	*ret = db.dbImpl.RowsColumnTypeDatabaseTypeName(args.A, args.B)
	return nil
}

type Z_DbRowsColumnTypePrecisionScaleReturn struct {
	A int64
	B int64
	C bool
}

func (db *dbRPCClient) RowsColumnTypePrecisionScale(rowsID string, index int) (int64, int64, bool) {
	args := &Z_DbRowsColumnArg{
		A: rowsID,
		B: index,
	}
	ret := &Z_DbRowsColumnTypePrecisionScaleReturn{}
	err := db.client.Call("Plugin.RowsColumnTypePrecisionScale", args, ret)
	if err != nil {
		log.Printf("error during Plugin.RowsColumnTypePrecisionScale: %v", err)
	}
	return ret.A, ret.B, ret.C
}

func (db *dbRPCServer) RowsColumnTypePrecisionScale(args *Z_DbRowsColumnArg, ret *Z_DbRowsColumnTypePrecisionScaleReturn) error {
	ret.A, ret.B, ret.C = db.dbImpl.RowsColumnTypePrecisionScale(args.A, args.B)
	return nil
}
