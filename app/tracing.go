package app

import (
	"context"
	"github.com/mattermost/mattermost-server/services/tracing"
	"github.com/opentracing/opentracing-go"
)

func (a *App) TraceStart(operationName string) (opentracing.Span, context.Context) {
	span, ctx := tracing.StartSpanWithParentByContext(a.Context, operationName)
	prevCtx := a.Context
	a.Context = ctx
	return span, prevCtx
}

func (a *App) TraceFinish(span opentracing.Span, ctx context.Context) {
	a.Context = ctx
	span.Finish()
}
