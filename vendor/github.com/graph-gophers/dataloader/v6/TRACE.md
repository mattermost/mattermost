# Adding a new trace backend.

If you whant to add a new tracing backend all you need to do is implement the
`Tracer` interface and pass it as an option to the dataloader on initialization.

As an example, this is how you could implement it to an OpenCensus backend.

```go
package main

import (
	"context"
	"strings"

    exp "go.opencensus.io/examples/exporter"
    "github.com/nicksrandall/dataloader"
	"go.opencensus.io/trace"
)

// OpenCensusTracer Tracer implements a tracer that can be used with the Open Tracing standard.
type OpenCensusTracer struct{}

// TraceLoad will trace a call to dataloader.LoadMany with Open Tracing
func (OpenCensusTracer) TraceLoad(ctx context.Context, key dataloader.Key) (context.Context, dataloader.TraceLoadFinishFunc) {
	cCtx, cSpan := trace.StartSpan(ctx, "Dataloader: load")
	cSpan.AddAttributes(
		trace.StringAttribute("dataloader.key", key.String()),
	)
	return cCtx, func(thunk dataloader.Thunk) {
		// TODO: is there anything we should do with the results?
		cSpan.End()
	}
}

// TraceLoadMany will trace a call to dataloader.LoadMany with Open Tracing
func (OpenCensusTracer) TraceLoadMany(ctx context.Context, keys dataloader.Keys) (context.Context, dataloader.TraceLoadManyFinishFunc) {
	cCtx, cSpan := trace.StartSpan(ctx, "Dataloader: loadmany")
	cSpan.AddAttributes(
		trace.StringAttribute("dataloader.keys", strings.Join(keys.Keys(), ",")),
	)
	return cCtx, func(thunk dataloader.ThunkMany) {
		// TODO: is there anything we should do with the results?
		cSpan.End()
	}
}

// TraceBatch will trace a call to dataloader.LoadMany with Open Tracing
func (OpenCensusTracer) TraceBatch(ctx context.Context, keys dataloader.Keys) (context.Context, dataloader.TraceBatchFinishFunc) {
	cCtx, cSpan := trace.StartSpan(ctx, "Dataloader: batch")
	cSpan.AddAttributes(
		trace.StringAttribute("dataloader.keys", strings.Join(keys.Keys(), ",")),
	)
	return cCtx, func(results []*dataloader.Result) {
		// TODO: is there anything we should do with the results?
		cSpan.End()
	}
}

func batchFunc(ctx context.Context, keys dataloader.Keys) []*dataloader.Result {
    // ...loader logic goes here
}

func main(){
    //initialize an example exporter that just logs to the console
    trace.ApplyConfig(trace.Config{
		DefaultSampler: trace.AlwaysSample(),
	})
    trace.RegisterExporter(&exp.PrintExporter{})
    // initialize the dataloader with your new tracer backend
    loader := dataloader.NewBatchedLoader(batchFunc, dataloader.WithTracer(OpenCensusTracer{}))
    // initialize a context since it's not receiving one from anywhere else.
    ctx, span := trace.StartSpan(context.TODO(), "Span Name")
    defer span.End()
    // request from the dataloader as usual
    value, err := loader.Load(ctx, dataloader.StringKey(SomeID))()
    // ...
}
```

Don't forget to initialize the exporters of your choice and register it with `trace.RegisterExporter(&exporterInstance)`.
