package graphql

import (
	"context"
	"errors"

	qerrors "github.com/graph-gophers/graphql-go/errors"
	"github.com/graph-gophers/graphql-go/internal/common"
	"github.com/graph-gophers/graphql-go/internal/exec"
	"github.com/graph-gophers/graphql-go/internal/exec/resolvable"
	"github.com/graph-gophers/graphql-go/internal/exec/selected"
	"github.com/graph-gophers/graphql-go/internal/query"
	"github.com/graph-gophers/graphql-go/internal/validation"
	"github.com/graph-gophers/graphql-go/introspection"
)

// Subscribe returns a response channel for the given subscription with the schema's
// resolver. It returns an error if the schema was created without a resolver.
// If the context gets cancelled, the response channel will be closed and no
// further resolvers will be called. The context error will be returned as soon
// as possible (not immediately).
func (s *Schema) Subscribe(ctx context.Context, queryString string, operationName string, variables map[string]interface{}) (<-chan interface{}, error) {
	if !s.res.Resolver.IsValid() {
		return nil, errors.New("schema created without resolver, can not subscribe")
	}
	if _, ok := s.schema.EntryPoints["subscription"]; !ok {
		return nil, errors.New("no subscriptions are offered by the schema")
	}
	return s.subscribe(ctx, queryString, operationName, variables, s.res), nil
}

func (s *Schema) subscribe(ctx context.Context, queryString string, operationName string, variables map[string]interface{}, res *resolvable.Schema) <-chan interface{} {
	doc, qErr := query.Parse(queryString)
	if qErr != nil {
		return sendAndReturnClosed(&Response{Errors: []*qerrors.QueryError{qErr}})
	}

	validationFinish := s.validationTracer.TraceValidation(ctx)
	errs := validation.Validate(s.schema, doc, variables, s.maxDepth)
	validationFinish(errs)
	if len(errs) != 0 {
		return sendAndReturnClosed(&Response{Errors: errs})
	}

	op, err := getOperation(doc, operationName)
	if err != nil {
		return sendAndReturnClosed(&Response{Errors: []*qerrors.QueryError{qerrors.Errorf("%s", err)}})
	}

	r := &exec.Request{
		Request: selected.Request{
			Doc:    doc,
			Vars:   variables,
			Schema: s.schema,
		},
		Limiter:                  make(chan struct{}, s.maxParallelism),
		Tracer:                   s.tracer,
		Logger:                   s.logger,
		PanicHandler:             s.panicHandler,
		SubscribeResolverTimeout: s.subscribeResolverTimeout,
	}
	varTypes := make(map[string]*introspection.Type)
	for _, v := range op.Vars {
		t, err := common.ResolveType(v.Type, s.schema.Resolve)
		if err != nil {
			return sendAndReturnClosed(&Response{Errors: []*qerrors.QueryError{err}})
		}
		varTypes[v.Name.Name] = introspection.WrapType(t)
	}

	if op.Type == query.Query || op.Type == query.Mutation {
		data, errs := r.Execute(ctx, res, op)
		return sendAndReturnClosed(&Response{Data: data, Errors: errs})
	}

	responses := r.Subscribe(ctx, res, op)
	c := make(chan interface{})
	go func() {
		for resp := range responses {
			c <- &Response{
				Data:   resp.Data,
				Errors: resp.Errors,
			}
		}
		close(c)
	}()

	return c
}

func sendAndReturnClosed(resp *Response) chan interface{} {
	c := make(chan interface{}, 1)
	c <- resp
	close(c)
	return c
}
