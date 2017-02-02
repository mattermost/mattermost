// +build go1.8

package pq

import (
	"context"
	"database/sql/driver"
	"errors"
)

// Implement the "QueryerContext" interface
func (cn *conn) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	list := make([]driver.Value, len(args))
	for i, nv := range args {
		list[i] = nv.Value
	}
	var closed chan<- struct{}
	if ctx.Done() != nil {
		closed = watchCancel(ctx, cn.cancel)
	}
	r, err := cn.query(query, list)
	if err != nil {
		return nil, err
	}
	r.closed = closed
	return r, nil
}

// Implement the "ExecerContext" interface
func (cn *conn) ExecContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	list := make([]driver.Value, len(args))
	for i, nv := range args {
		list[i] = nv.Value
	}

	if ctx.Done() != nil {
		closed := watchCancel(ctx, cn.cancel)
		defer close(closed)
	}

	return cn.Exec(query, list)
}

// Implement the "ConnBeginTx" interface
func (cn *conn) BeginTx(ctx context.Context, opts driver.TxOptions) (driver.Tx, error) {
	if opts.Isolation != 0 {
		return nil, errors.New("isolation levels not supported")
	}
	if opts.ReadOnly {
		return nil, errors.New("read-only transactions not supported")
	}
	tx, err := cn.Begin()
	if err != nil {
		return nil, err
	}
	if ctx.Done() != nil {
		cn.txnClosed = watchCancel(ctx, cn.cancel)
	}
	return tx, nil
}

func watchCancel(ctx context.Context, cancel func()) chan<- struct{} {
	closed := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			cancel()
		case <-closed:
		}
	}()
	return closed
}

func (cn *conn) cancel() {
	var err error
	can := &conn{}
	can.c, err = dial(cn.dialer, cn.opts)
	if err != nil {
		return
	}
	can.ssl(cn.opts)

	defer can.errRecover(&err)

	w := can.writeBuf(0)
	w.int32(80877102) // cancel request code
	w.int32(cn.processID)
	w.int32(cn.secretKey)

	can.sendStartupPacket(w)
	_ = can.c.Close()
}
