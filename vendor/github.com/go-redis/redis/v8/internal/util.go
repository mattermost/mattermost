package internal

import (
	"context"
	"time"

	"github.com/go-redis/redis/v8/internal/proto"
	"github.com/go-redis/redis/v8/internal/util"
	"go.opentelemetry.io/otel/api/global"
	"go.opentelemetry.io/otel/api/trace"
)

func Sleep(ctx context.Context, dur time.Duration) error {
	return WithSpan(ctx, "sleep", func(ctx context.Context) error {
		t := time.NewTimer(dur)
		defer t.Stop()

		select {
		case <-t.C:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	})
}

func ToLower(s string) string {
	if isLower(s) {
		return s
	}

	b := make([]byte, len(s))
	for i := range b {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		b[i] = c
	}
	return util.BytesToString(b)
}

func isLower(s string) bool {
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			return false
		}
	}
	return true
}

func Unwrap(err error) error {
	u, ok := err.(interface {
		Unwrap() error
	})
	if !ok {
		return nil
	}
	return u.Unwrap()
}

//------------------------------------------------------------------------------

func WithSpan(ctx context.Context, name string, fn func(context.Context) error) error {
	if !trace.SpanFromContext(ctx).IsRecording() {
		return fn(ctx)
	}

	ctx, span := global.Tracer("github.com/go-redis/redis").Start(ctx, name)
	defer span.End()

	return fn(ctx)
}

func RecordError(ctx context.Context, err error) error {
	if err != proto.Nil {
		trace.SpanFromContext(ctx).RecordError(ctx, err)
	}
	return err
}
