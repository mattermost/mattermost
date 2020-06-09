// +build go1.8

package squirrel

import (
	"context"
	"database/sql"

	"github.com/lann/builder"
)

func (d *deleteData) ExecContext(ctx context.Context) (sql.Result, error) {
	if d.RunWith == nil {
		return nil, RunnerNotSet
	}
	ctxRunner, ok := d.RunWith.(ExecerContext)
	if !ok {
		return nil, NoContextSupport
	}
	return ExecContextWith(ctx, ctxRunner, d)
}

// ExecContext builds and ExecContexts the query with the Runner set by RunWith.
func (b DeleteBuilder) ExecContext(ctx context.Context) (sql.Result, error) {
	data := builder.GetStruct(b).(deleteData)
	return data.ExecContext(ctx)
}
