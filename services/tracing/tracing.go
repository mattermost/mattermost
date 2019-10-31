package tracing

import (
	"time"

	opentracing "github.com/opentracing/opentracing-go"
	"github.com/uber/jaeger-lib/metrics"

	"context"

	"github.com/uber/jaeger-client-go"
	jaegercfg "github.com/uber/jaeger-client-go/config"
	jaegerlog "github.com/uber/jaeger-client-go/log"
)

var initialized = false

func Initialize() error {
	if (initialized) {
		return nil
	}
	cfg := jaegercfg.Configuration{
		Sampler: &jaegercfg.SamplerConfig{
			Type:  jaeger.SamplerTypeConst,
			Param: 1,
		},
		Reporter: &jaegercfg.ReporterConfig{
			LogSpans: true,
		},
	}

	// TODO: Use Closer returned
	_, err := cfg.InitGlobalTracer(
		"mattermost",
		jaegercfg.Logger(jaegerlog.StdLogger),
		jaegercfg.Metrics(metrics.NullFactory),
		jaegercfg.Tag("at", time.Now().UTC().Format(time.RFC3339)),
	)
	if err != nil {
		return err
	}

	initialized = true

	return nil
}

func StartRootSpanByContext(ctx context.Context, operationName string) (opentracing.Span, context.Context) {
	return opentracing.StartSpanFromContext(ctx, operationName)
}

func StartSpanWithParentByContext(ctx context.Context, operationName string) (opentracing.Span, context.Context) {
	parentSpan := opentracing.SpanFromContext(ctx)

	if parentSpan == nil {
		return StartRootSpanByContext(ctx, operationName)
	}

	return opentracing.StartSpanFromContext(ctx, operationName, opentracing.ChildOf(parentSpan.Context()))
}
