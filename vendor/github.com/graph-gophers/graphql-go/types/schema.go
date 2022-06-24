package types

// Schema represents a GraphQL service's collective type system capabilities.
// A schema is defined in terms of the types and directives it supports as well as the root
// operation types for each kind of operation: `query`, `mutation`, and `subscription`.
//
// For a more formal definition, read the relevant section in the specification:
//
// http://spec.graphql.org/draft/#sec-Schema
type Schema struct {
	// EntryPoints determines the place in the type system where `query`, `mutation`, and
	// `subscription` operations begin.
	//
	// http://spec.graphql.org/draft/#sec-Root-Operation-Types
	//
	EntryPoints map[string]NamedType

	// Types are the fundamental unit of any GraphQL schema.
	// There are six kinds of named types, and two wrapping types.
	//
	// http://spec.graphql.org/draft/#sec-Types
	Types map[string]NamedType

	// Directives are used to annotate various parts of a GraphQL document as an indicator that they
	// should be evaluated differently by a validator, executor, or client tool such as a code
	// generator.
	//
	// http://spec.graphql.org/#sec-Type-System.Directives
	Directives map[string]*DirectiveDefinition

	UseFieldResolvers bool

	EntryPointNames map[string]string
	Objects         []*ObjectTypeDefinition
	Unions          []*Union
	Enums           []*EnumTypeDefinition
	Extensions      []*Extension
	SchemaString    string
}

func (s *Schema) Resolve(name string) Type {
	return s.Types[name]
}
