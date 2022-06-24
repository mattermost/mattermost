package exec

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"time"

	"github.com/graph-gophers/graphql-go/errors"
	"github.com/graph-gophers/graphql-go/internal/exec/resolvable"
	"github.com/graph-gophers/graphql-go/internal/exec/selected"
	"github.com/graph-gophers/graphql-go/types"
)

type Response struct {
	Data   json.RawMessage
	Errors []*errors.QueryError
}

func (r *Request) Subscribe(ctx context.Context, s *resolvable.Schema, op *types.OperationDefinition) <-chan *Response {
	var result reflect.Value
	var f *fieldToExec
	var err *errors.QueryError
	func() {
		defer r.handlePanic(ctx)

		sels := selected.ApplyOperation(&r.Request, s, op)
		var fields []*fieldToExec
		collectFieldsToResolve(sels, s, s.Resolver, &fields, make(map[string]*fieldToExec))

		// TODO: move this check into validation.Validate
		if len(fields) != 1 {
			err = errors.Errorf("%s", "can subscribe to at most one subscription at a time")
			return
		}
		f = fields[0]

		var in []reflect.Value
		if f.field.HasContext {
			in = append(in, reflect.ValueOf(ctx))
		}
		if f.field.ArgsPacker != nil {
			in = append(in, f.field.PackedArgs)
		}
		callOut := f.resolver.Method(f.field.MethodIndex).Call(in)
		result = callOut[0]

		if f.field.HasError && !callOut[1].IsNil() {
			switch resolverErr := callOut[1].Interface().(type) {
			case *errors.QueryError:
				err = resolverErr
			case error:
				err = errors.Errorf("%s", resolverErr)
				err.ResolverError = resolverErr
			default:
				panic(fmt.Errorf("can only deal with *QueryError and error types, got %T", resolverErr))
			}
		}
	}()

	// Handles the case where the locally executed func above panicked
	if len(r.Request.Errs) > 0 {
		return sendAndReturnClosed(&Response{Errors: r.Request.Errs})
	}

	if f == nil {
		return sendAndReturnClosed(&Response{Errors: []*errors.QueryError{err}})
	}

	if err != nil {
		if _, nonNullChild := f.field.Type.(*types.NonNull); nonNullChild {
			return sendAndReturnClosed(&Response{Errors: []*errors.QueryError{err}})
		}
		return sendAndReturnClosed(&Response{Data: []byte(fmt.Sprintf(`{"%s":null}`, f.field.Alias)), Errors: []*errors.QueryError{err}})
	}

	if ctxErr := ctx.Err(); ctxErr != nil {
		return sendAndReturnClosed(&Response{Errors: []*errors.QueryError{errors.Errorf("%s", ctxErr)}})
	}

	c := make(chan *Response)
	// TODO: handle resolver nil channel better?
	if result.IsZero() {
		close(c)
		return c
	}

	go func() {
		for {
			// Check subscription context
			chosen, resp, ok := reflect.Select([]reflect.SelectCase{
				{
					Dir:  reflect.SelectRecv,
					Chan: reflect.ValueOf(ctx.Done()),
				},
				{
					Dir:  reflect.SelectRecv,
					Chan: result,
				},
			})
			switch chosen {
			// subscription context done
			case 0:
				close(c)
				return
			// upstream received
			case 1:
				// upstream closed
				if !ok {
					close(c)
					return
				}

				subR := &Request{
					Request: selected.Request{
						Doc:    r.Request.Doc,
						Vars:   r.Request.Vars,
						Schema: r.Request.Schema,
					},
					Limiter: r.Limiter,
					Tracer:  r.Tracer,
					Logger:  r.Logger,
				}
				var out bytes.Buffer
				func() {
					timeout := r.SubscribeResolverTimeout
					if timeout == 0 {
						timeout = time.Second
					}

					subCtx, cancel := context.WithTimeout(ctx, timeout)
					defer cancel()

					// resolve response
					func() {
						defer subR.handlePanic(subCtx)

						var buf bytes.Buffer
						subR.execSelectionSet(subCtx, f.sels, f.field.Type, &pathSegment{nil, f.field.Alias}, s, resp, &buf)

						propagateChildError := false
						if _, nonNullChild := f.field.Type.(*types.NonNull); nonNullChild && resolvedToNull(&buf) {
							propagateChildError = true
						}

						if !propagateChildError {
							out.WriteString(fmt.Sprintf(`{"%s":`, f.field.Alias))
							out.Write(buf.Bytes())
							out.WriteString(`}`)
						}
					}()

					if err := subCtx.Err(); err != nil {
						c <- &Response{Errors: []*errors.QueryError{errors.Errorf("%s", err)}}
						return
					}

					// Send response within timeout
					// TODO: maybe block until sent?
					select {
					case <-subCtx.Done():
					case c <- &Response{Data: out.Bytes(), Errors: subR.Errs}:
					}
				}()
			}
		}
	}()

	return c
}

func sendAndReturnClosed(resp *Response) chan *Response {
	c := make(chan *Response, 1)
	c <- resp
	close(c)
	return c
}
