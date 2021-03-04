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

// UnwrappableError describes errors compatible with errors.Unwrap.
type UnwrappableError interface {
	// Unwrap returns the proximate cause of this error.
	Unwrap() error
}

// Unwrap is equivalent to errors.Unwrap. It's implemented here to maintain
// compatibility with Go versions before 1.13 (when the errors package was
// introduced).
// It returns the result of calling the Unwrap method on err, if err's type
// implements UnwrappableError.
// Otherwise, Unwrap returns nil.
func Unwrap(err error) error {
	u, ok := err.(UnwrappableError)
	if !ok {
		return nil
	}
	return u.Unwrap()
}

// errorCause returns the original cause of the error, if possible. An error has
// a proximate cause if it's type is compatible with Go's errors.Unwrap() (and
// also, for legacy reasons, if it implements ErrorCauser); the original cause
// is the bottom of the causal chain.
func errorCause(err error) error {
	// First handle errors implementing ErrorCauser.
	for err != nil {
		cause, ok := err.(ErrorCauser)
		if !ok {
			break
		}
		err = cause.Cause()
	}
	// Then handle go1.13+ error wrapping.
	for {
		cause := Unwrap(err)
		if cause == nil {
			break
		}
		err = cause
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
