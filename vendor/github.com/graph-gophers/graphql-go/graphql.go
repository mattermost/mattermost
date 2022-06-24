package graphql

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/graph-gophers/graphql-go/errors"
	"github.com/graph-gophers/graphql-go/internal/common"
	"github.com/graph-gophers/graphql-go/internal/exec"
	"github.com/graph-gophers/graphql-go/internal/exec/resolvable"
	"github.com/graph-gophers/graphql-go/internal/exec/selected"
	"github.com/graph-gophers/graphql-go/internal/query"
	"github.com/graph-gophers/graphql-go/internal/schema"
	"github.com/graph-gophers/graphql-go/internal/validation"
	"github.com/graph-gophers/graphql-go/introspection"
	"github.com/graph-gophers/graphql-go/log"
	"github.com/graph-gophers/graphql-go/trace/noop"
	"github.com/graph-gophers/graphql-go/trace/tracer"
	"github.com/graph-gophers/graphql-go/types"
)

// ParseSchema parses a GraphQL schema and attaches the given root resolver. It returns an error if
// the Go type signature of the resolvers does not match the schema. If nil is passed as the
// resolver, then the schema can not be executed, but it may be inspected (e.g. with ToJSON).
func ParseSchema(schemaString string, resolver interface{}, opts ...SchemaOpt) (*Schema, error) {
	s := &Schema{
		schema:         schema.New(),
		maxParallelism: 10,
		tracer:         noop.Tracer{},
		logger:         &log.DefaultLogger{},
		panicHandler:   &errors.DefaultPanicHandler{},
	}
	for _, opt := range opts {
		opt(s)
	}

	if s.validationTracer == nil {
		if t, ok := s.tracer.(tracer.ValidationTracer); ok {
			s.validationTracer = t
		} else {
			s.validationTracer = &validationBridgingTracer{tracer: tracer.LegacyNoopValidationTracer{}} //nolint:staticcheck
		}
	}

	if err := schema.Parse(s.schema, schemaString, s.useStringDescriptions); err != nil {
		return nil, err
	}
	if err := s.validateSchema(); err != nil {
		return nil, err
	}

	r, err := resolvable.ApplyResolver(s.schema, resolver)
	if err != nil {
		return nil, err
	}
	s.res = r

	return s, nil
}

// MustParseSchema calls ParseSchema and panics on error.
func MustParseSchema(schemaString string, resolver interface{}, opts ...SchemaOpt) *Schema {
	s, err := ParseSchema(schemaString, resolver, opts...)
	if err != nil {
		panic(err)
	}
	return s
}

// Schema represents a GraphQL schema with an optional resolver.
type Schema struct {
	schema *types.Schema
	res    *resolvable.Schema

	maxDepth                 int
	maxParallelism           int
	tracer                   tracer.Tracer
	validationTracer         tracer.ValidationTracer
	logger                   log.Logger
	panicHandler             errors.PanicHandler
	useStringDescriptions    bool
	disableIntrospection     bool
	subscribeResolverTimeout time.Duration
}

func (s *Schema) ASTSchema() *types.Schema {
	return s.schema
}

// SchemaOpt is an option to pass to ParseSchema or MustParseSchema.
type SchemaOpt func(*Schema)

// UseStringDescriptions enables the usage of double quoted and triple quoted
// strings as descriptions as per the June 2018 spec
// https://facebook.github.io/graphql/June2018/. When this is not enabled,
// comments are parsed as descriptions instead.
func UseStringDescriptions() SchemaOpt {
	return func(s *Schema) {
		s.useStringDescriptions = true
	}
}

// UseFieldResolvers specifies whether to use struct field resolvers
func UseFieldResolvers() SchemaOpt {
	return func(s *Schema) {
		s.schema.UseFieldResolvers = true
	}
}

// MaxDepth specifies the maximum field nesting depth in a query. The default is 0 which disables max depth checking.
func MaxDepth(n int) SchemaOpt {
	return func(s *Schema) {
		s.maxDepth = n
	}
}

// MaxParallelism specifies the maximum number of resolvers per request allowed to run in parallel. The default is 10.
func MaxParallelism(n int) SchemaOpt {
	return func(s *Schema) {
		s.maxParallelism = n
	}
}

// Tracer is used to trace queries and fields. It defaults to tracer.Noop.
func Tracer(t tracer.Tracer) SchemaOpt {
	return func(s *Schema) {
		s.tracer = t
	}
}

// ValidationTracer is used to trace validation errors. It defaults to tracer.LegacyNoopValidationTracer.
// Deprecated: context is needed to support tracing correctly. Use a Tracer which implements tracer.ValidationTracer.
func ValidationTracer(tracer tracer.LegacyValidationTracer) SchemaOpt { //nolint:staticcheck
	return func(s *Schema) {
		s.validationTracer = &validationBridgingTracer{tracer: tracer}
	}
}

// Logger is used to log panics during query execution. It defaults to exec.DefaultLogger.
func Logger(logger log.Logger) SchemaOpt {
	return func(s *Schema) {
		s.logger = logger
	}
}

// PanicHandler is used to customize the panic errors during query execution.
// It defaults to errors.DefaultPanicHandler.
func PanicHandler(panicHandler errors.PanicHandler) SchemaOpt {
	return func(s *Schema) {
		s.panicHandler = panicHandler
	}
}

// DisableIntrospection disables introspection queries.
func DisableIntrospection() SchemaOpt {
	return func(s *Schema) {
		s.disableIntrospection = true
	}
}

// SubscribeResolverTimeout is an option to control the amount of time
// we allow for a single subscribe message resolver to complete it's job
// before it times out and returns an error to the subscriber.
func SubscribeResolverTimeout(timeout time.Duration) SchemaOpt {
	return func(s *Schema) {
		s.subscribeResolverTimeout = timeout
	}
}

// Response represents a typical response of a GraphQL server. It may be encoded to JSON directly or
// it may be further processed to a custom response type, for example to include custom error data.
// Errors are intentionally serialized first based on the advice in https://github.com/facebook/graphql/commit/7b40390d48680b15cb93e02d46ac5eb249689876#diff-757cea6edf0288677a9eea4cfc801d87R107
type Response struct {
	Errors     []*errors.QueryError   `json:"errors,omitempty"`
	Data       json.RawMessage        `json:"data,omitempty"`
	Extensions map[string]interface{} `json:"extensions,omitempty"`
}

// Validate validates the given query with the schema.
func (s *Schema) Validate(queryString string) []*errors.QueryError {
	return s.ValidateWithVariables(queryString, nil)
}

// ValidateWithVariables validates the given query with the schema and the input variables.
func (s *Schema) ValidateWithVariables(queryString string, variables map[string]interface{}) []*errors.QueryError {
	doc, qErr := query.Parse(queryString)
	if qErr != nil {
		return []*errors.QueryError{qErr}
	}

	return validation.Validate(s.schema, doc, variables, s.maxDepth)
}

// Exec executes the given query with the schema's resolver. It panics if the schema was created
// without a resolver. If the context get cancelled, no further resolvers will be called and a
// the context error will be returned as soon as possible (not immediately).
func (s *Schema) Exec(ctx context.Context, queryString string, operationName string, variables map[string]interface{}) *Response {
	if !s.res.Resolver.IsValid() {
		panic("schema created without resolver, can not exec")
	}
	return s.exec(ctx, queryString, operationName, variables, s.res)
}

func (s *Schema) exec(ctx context.Context, queryString string, operationName string, variables map[string]interface{}, res *resolvable.Schema) *Response {
	doc, qErr := query.Parse(queryString)
	if qErr != nil {
		return &Response{Errors: []*errors.QueryError{qErr}}
	}

	validationFinish := s.validationTracer.TraceValidation(ctx)
	errs := validation.Validate(s.schema, doc, variables, s.maxDepth)
	validationFinish(errs)
	if len(errs) != 0 {
		return &Response{Errors: errs}
	}

	op, err := getOperation(doc, operationName)
	if err != nil {
		return &Response{Errors: []*errors.QueryError{errors.Errorf("%s", err)}}
	}

	// If the optional "operationName" POST parameter is not provided then
	// use the query's operation name for improved tracing.
	if operationName == "" {
		operationName = op.Name.Name
	}

	// Subscriptions are not valid in Exec. Use schema.Subscribe() instead.
	if op.Type == query.Subscription {
		return &Response{Errors: []*errors.QueryError{{Message: "graphql-ws protocol header is missing"}}}
	}
	if op.Type == query.Mutation {
		if _, ok := s.schema.EntryPoints["mutation"]; !ok {
			return &Response{Errors: []*errors.QueryError{{Message: "no mutations are offered by the schema"}}}
		}
	}

	// Fill in variables with the defaults from the operation
	if variables == nil {
		variables = make(map[string]interface{}, len(op.Vars))
	}
	for _, v := range op.Vars {
		if _, ok := variables[v.Name.Name]; !ok && v.Default != nil {
			variables[v.Name.Name] = v.Default.Deserialize(nil)
		}
	}

	r := &exec.Request{
		Request: selected.Request{
			Doc:                  doc,
			Vars:                 variables,
			Schema:               s.schema,
			DisableIntrospection: s.disableIntrospection,
		},
		Limiter:      make(chan struct{}, s.maxParallelism),
		Tracer:       s.tracer,
		Logger:       s.logger,
		PanicHandler: s.panicHandler,
	}
	varTypes := make(map[string]*introspection.Type)
	for _, v := range op.Vars {
		t, err := common.ResolveType(v.Type, s.schema.Resolve)
		if err != nil {
			return &Response{Errors: []*errors.QueryError{err}}
		}
		varTypes[v.Name.Name] = introspection.WrapType(t)
	}
	traceCtx, finish := s.tracer.TraceQuery(ctx, queryString, operationName, variables, varTypes)
	data, errs := r.Execute(traceCtx, res, op)
	finish(errs)

	return &Response{
		Data:   data,
		Errors: errs,
	}
}

func (s *Schema) validateSchema() error {
	// https://graphql.github.io/graphql-spec/June2018/#sec-Root-Operation-Types
	// > The query root operation type must be provided and must be an Object type.
	if err := validateRootOp(s.schema, "query", true); err != nil {
		return err
	}
	// > The mutation root operation type is optional; if it is not provided, the service does not support mutations.
	// > If it is provided, it must be an Object type.
	if err := validateRootOp(s.schema, "mutation", false); err != nil {
		return err
	}
	// > Similarly, the subscription root operation type is also optional; if it is not provided, the service does not
	// > support subscriptions. If it is provided, it must be an Object type.
	if err := validateRootOp(s.schema, "subscription", false); err != nil {
		return err
	}
	return nil
}

type validationBridgingTracer struct {
	tracer tracer.LegacyValidationTracer //nolint:staticcheck
}

func (t *validationBridgingTracer) TraceValidation(context.Context) func([]*errors.QueryError) {
	return t.tracer.TraceValidation()
}

func validateRootOp(s *types.Schema, name string, mandatory bool) error {
	t, ok := s.EntryPoints[name]
	if !ok {
		if mandatory {
			return fmt.Errorf("root operation %q must be defined", name)
		}
		return nil
	}
	if t.Kind() != "OBJECT" {
		return fmt.Errorf("root operation %q must be an OBJECT", name)
	}
	return nil
}

func getOperation(document *types.ExecutableDefinition, operationName string) (*types.OperationDefinition, error) {
	if len(document.Operations) == 0 {
		return nil, fmt.Errorf("no operations in query document")
	}

	if operationName == "" {
		if len(document.Operations) > 1 {
			return nil, fmt.Errorf("more than one operation in query document and no operation name given")
		}
		for _, op := range document.Operations {
			return op, nil // return the one and only operation
		}
	}

	op := document.Operations.Get(operationName)
	if op == nil {
		return nil, fmt.Errorf("no operation with name %q", operationName)
	}
	return op, nil
}
