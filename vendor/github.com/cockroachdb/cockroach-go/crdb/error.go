package crdb

import "fmt"

// ErrorCauser is the type implemented by an error that remembers its cause.
//
// ErrorCauser is intentionally equivalent to the causer interface used by
// the github.com/pkg/errors package.
type ErrorCauser interface {
	// Cause returns the proximate cause of this error.
	Cause() error
}

// errorCause returns the original cause of the error, if possible. An error has
// a proximate cause if it implements ErrorCauser; the original cause is the
// first error in the cause chain that does not implement ErrorCauser.
//
// errorCause is intentionally equivalent to pkg/errors.Cause.
func errorCause(err error) error {
	for err != nil {
		cause, ok := err.(ErrorCauser)
		if !ok {
			break
		}
		err = cause.Cause()
	}
	return err
}

type txError struct {
	cause error
}

// Error implements the error interface.
func (e *txError) Error() string { return e.cause.Error() }

// Cause implements the ErrorCauser interface.
func (e *txError) Cause() error { return e.cause }

// AmbiguousCommitError represents an error that left a transaction in an
// ambiguous state: unclear if it committed or not.
type AmbiguousCommitError struct {
	txError
}

func newAmbiguousCommitError(err error) *AmbiguousCommitError {
	return &AmbiguousCommitError{txError{cause: err}}
}

// TxnRestartError represents an error when restarting a transaction. `cause` is
// the error from restarting the txn and `retryCause` is the original error which
// triggered the restart.
type TxnRestartError struct {
	txError
	retryCause error
	msg        string
}

func newTxnRestartError(err error, retryErr error) *TxnRestartError {
	const msgPattern = "restarting txn failed. ROLLBACK TO SAVEPOINT " +
		"encountered error: %s. Original error: %s."
	return &TxnRestartError{
		txError:    txError{cause: err},
		retryCause: retryErr,
		msg:        fmt.Sprintf(msgPattern, err, retryErr),
	}
}

// Error implements the error interface.
func (e *TxnRestartError) Error() string { return e.msg }

// RetryCause returns the error that caused the transaction to be restarted.
func (e *TxnRestartError) RetryCause() error { return e.retryCause }
