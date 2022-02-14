package decode

// Unmarshaler defines the api of Go types mapped to custom GraphQL scalar types
type Unmarshaler interface {
	// ImplementsGraphQLType maps the implementing custom Go type
	// to the GraphQL scalar type in the schema.
	ImplementsGraphQLType(name string) bool
	// UnmarshalGraphQL is the custom unmarshaler for the implementing type
	//
	// This function will be called whenever you use the
	// custom GraphQL scalar type as an input
	UnmarshalGraphQL(input interface{}) error
}
