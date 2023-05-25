// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package tracing

import (
	"context"
	"io"
	"time"

	opentracing "github.com/opentracing/opentracing-go"
	"github.com/uber/jaeger-client-go"
	jaegercfg "github.com/uber/jaeger-client-go/config"
	"github.com/uber/jaeger-client-go/zipkin"
	"github.com/uber/jaeger-lib/metrics"

	"github.com/mattermost/mattermost-server/server/public/shared/mlog"
)

// Tracer is a wrapper around Jaeger OpenTracing client, used to properly de-initialize jaeger on exit
type Tracer struct {
	closer io.Closer
}

type LogrusAdapter struct {
}

// Error - logrus adapter for span errors
func (LogrusAdapter) Error(msg string) {
	mlog.Error(msg)
}

// Infof - logrus adapter for span info logging
func (LogrusAdapter) Infof(msg string, args ...any) {
	// we ignore Info messages from opentracing
}

// New instantiates Jaeger opentracing client with default options
// To override the defaults use environment variables listed here: https://github.com/jaegertracing/jaeger-client-go/blob/master/config/config.go
func New() (*Tracer, error) {
	cfg := jaegercfg.Configuration{
		Sampler: &jaegercfg.SamplerConfig{
			Type:  jaeger.SamplerTypeConst,
			Param: 1,
		},
		Reporter: &jaegercfg.ReporterConfig{
			LogSpans: true,
		},
	}

	zipkinPropagator := zipkin.NewZipkinB3HTTPHeaderPropagator()

	closer, err := cfg.InitGlobalTracer(
		"mattermost",
		jaegercfg.Logger(LogrusAdapter{}),
		jaegercfg.Metrics(metrics.NullFactory),
		jaegercfg.Tag("serverStartTime", time.Now().UTC().Format(time.RFC3339)),
		jaegercfg.Injector(opentracing.HTTPHeaders, zipkinPropagator),
		jaegercfg.Extractor(opentracing.HTTPHeaders, zipkinPropagator),
		jaegercfg.ZipkinSharedRPCSpan(true),
	)
	if err != nil {
		return nil, err
	}
	mlog.Info("Opentracing initialized")
	return &Tracer{
		closer: closer,
	}, nil
}

func (t *Tracer) Close() error {
	return t.closer.Close()
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
