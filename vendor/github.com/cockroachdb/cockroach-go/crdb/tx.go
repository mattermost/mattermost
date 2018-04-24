// Copyright 2016 The Cockroach Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
// implied. See the License for the specific language governing
// permissions and limitations under the License.

// Package crdb provides helpers for using CockroachDB in client
// applications.
package crdb

import (
	"context"
	"database/sql"

	"github.com/lib/pq"
)

// ExecuteTx runs fn inside a transaction and retries it as needed.
// On non-retryable failures, the transaction is aborted and rolled
// back; on success, the transaction is committed.
// There are cases where the state of a transaction is inherently ambiguous: if
// we err on RELEASE with a communication error it's unclear if the transaction
// has been committed or not (similar to erroring on COMMIT in other databases).
// In that case, we return AmbiguousCommitError.
// There are cases when restarting a transaction fails: we err on ROLLBACK
// to the SAVEPOINT. In that case, we return a TxnRestartError.
//
// For more information about CockroachDB's transaction model see
// https://cockroachlabs.com/docs/stable/transactions.html.
//
// NOTE: the supplied fn closure should not have external side
// effects beyond changes to the database.
//
// fn must take care when wrapping errors returned from the database driver with
// additional context. For example, if the UPDATE statement fails in the
// following snippet, the original retryable error will be masked by the call to
// fmt.Errorf, and the transaction will not be automatically retried.
//
//    crdb.ExecuteTx(ctx, db, txopts, func (tx *sql.Tx) error {
//        if err := tx.ExecContext(ctx, "UPDATE..."); err != nil {
//            return fmt.Errorf("updating record: %s", err)
//        }
//        return nil
//    })
//
// Instead, add context by returning an error that implements the ErrorCauser
// interface. Either create a custom error type that implements ErrorCauser or
// use a helper function that does so automatically, like pkg/errors.Wrap:
//
//    import "github.com/pkg/errors"
//
//    crdb.ExecuteTx(ctx, db, txopts, func (tx *sql.Tx) error {
//        if err := tx.ExecContext(ctx, "UPDATE..."); err != nil {
//            return errors.Wrap(err, "updating record")
//        }
//        return nil
//    })
//
func ExecuteTx(ctx context.Context, db *sql.DB, txopts *sql.TxOptions, fn func(*sql.Tx) error) error {
	// Start a transaction.
	tx, err := db.BeginTx(ctx, txopts)
	if err != nil {
		return err
	}
	return ExecuteInTx(ctx, tx, func() error { return fn(tx) })
}

// Tx is used to permit clients to implement custom transaction logic.
type Tx interface {
	ExecContext(context.Context, string, ...interface{}) (sql.Result, error)
	Commit() error
	Rollback() error
}

// ExecuteInTx runs fn inside tx which should already have begun.
// *WARNING*: Do not execute any statements on the supplied tx before calling this function.
// ExecuteInTx will only retry statements that are performed within the supplied
// closure (fn). Any statements performed on the tx before ExecuteInTx is invoked will *not*
// be re-run if the transaction needs to be retried.
//
// fn is subject to the same restrictions as the fn passed to ExecuteTx.
func ExecuteInTx(ctx context.Context, tx Tx, fn func() error) (err error) {
	defer func() {
		if err == nil {
			// Ignore commit errors. The tx has already been committed by RELEASE.
			_ = tx.Commit()
		} else {
			// We always need to execute a Rollback() so sql.DB releases the
			// connection.
			_ = tx.Rollback()
		}
	}()
	// Specify that we intend to retry this txn in case of CockroachDB retryable
	// errors.
	if _, err = tx.ExecContext(ctx, "SAVEPOINT cockroach_restart"); err != nil {
		return err
	}

	for {
		released := false
		err = fn()
		if err == nil {
			// RELEASE acts like COMMIT in CockroachDB. We use it since it gives us an
			// opportunity to react to retryable errors, whereas tx.Commit() doesn't.
			released = true
			if _, err = tx.ExecContext(ctx, "RELEASE SAVEPOINT cockroach_restart"); err == nil {
				return nil
			}
		}
		// We got an error; let's see if it's a retryable one and, if so, restart. We look
		// for either the standard PG errcode SerializationFailureError:40001 or the Cockroach extension
		// errcode RetriableError:CR000. The Cockroach extension has been removed server-side, but support
		// for it has been left here for now to maintain backwards compatibility.
		pqErr, ok := errorCause(err).(*pq.Error)
		if retryable := ok && (pqErr.Code == "CR000" || pqErr.Code == "40001"); !retryable {
			if released {
				err = newAmbiguousCommitError(err)
			}
			return err
		}
		if _, retryErr := tx.ExecContext(ctx, "ROLLBACK TO SAVEPOINT cockroach_restart"); retryErr != nil {
			return newTxnRestartError(retryErr, err)
		}
	}
}
