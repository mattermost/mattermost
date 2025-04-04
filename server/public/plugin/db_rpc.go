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
	// Buffer for batched rows, keyed by rowsID
	rowsBuffer map[string][][]driver.Value
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
	// Clean up any buffered rows for this result set
	if db.rowsBuffer != nil {
		delete(db.rowsBuffer, resID)
	}

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

type Z_DbRowScanBatchArg struct {
	A string
	B int
}

type Z_DbRowScanBatchReturn struct {
	A error
	B [][]driver.Value
}

func (db *dbRPCClient) RowsNext(rowsID string, dest []driver.Value) error {
	// Check if we have buffered rows for this rowsID
	if db.rowsBuffer == nil {
		db.rowsBuffer = make(map[string][][]driver.Value)
	}

	buffer, ok := db.rowsBuffer[rowsID]
	if !ok || len(buffer) == 0 {
		// No buffered rows, fetch a batch starting with size 16 and doubling each time
		batchSize := 16
		if ok {
			// If we've fetched before but exhausted the buffer, double the batch size
			batchSize = len(buffer) * 2
			if batchSize <= 0 || batchSize > 4096 {
				batchSize = 4096 // Cap at 4096 rows per batch
			}
		}

		// Fetch a new batch
		batch, err := db.RowsNextBatch(rowsID, batchSize)
		if err != nil {
			return err
		}

		// Store the batch in the buffer
		db.rowsBuffer[rowsID] = batch
		buffer = batch

		// If batch is empty, return io.EOF (or whatever the underlying driver returns for end of rows)
		if len(buffer) == 0 {
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
			return ret.A
		}
	}

	// Get the first row from the buffer
	row := buffer[0]
	// Remove the first row from the buffer
	db.rowsBuffer[rowsID] = buffer[1:]

	// Copy the values to the destination
	copy(dest, row)

	return nil
}

func (db *dbRPCClient) RowsNextBatch(rowsID string, batchSize int) ([][]driver.Value, error) {
	args := &Z_DbRowScanBatchArg{
		A: rowsID,
		B: batchSize,
	}
	ret := &Z_DbRowScanBatchReturn{}
	err := db.client.Call("Plugin.RowsNextBatch", args, ret)
	if err != nil {
		log.Printf("error during Plugin.RowsNextBatch: %v", err)
	}
	ret.A = decodableError(ret.A)
	return ret.B, ret.A
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

func (db *dbRPCServer) RowsNextBatch(args *Z_DbRowScanBatchArg, ret *Z_DbRowScanBatchReturn) error {
	// Initialize the batch result
	batch := make([][]driver.Value, 0, args.B)

	// Fetch up to batchSize rows
	for i := 0; i < args.B; i++ {
		// Create a destination slice for the current row
		dest := make([]driver.Value, len(db.dbImpl.RowsColumns(args.A)))

		// Fetch the next row
		err := db.dbImpl.RowsNext(args.A, dest)
		if err != nil {
			// If we hit an error (like EOF), stop fetching and return what we have so far
			ret.A = encodableError(err)
			// Only return the error if we didn't get any rows
			if i == 0 {
				ret.B = batch
				return nil
			}
			// Otherwise, return the rows we got so far without an error
			ret.A = nil
			break
		}

		// Add the row to the batch
		batch = append(batch, dest)
	}

	ret.B = batch
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
