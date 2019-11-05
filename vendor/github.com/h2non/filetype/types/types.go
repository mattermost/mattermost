package types

var Types = make(map[string]Type)

// Add registers a new type in the package
func Add(t Type) Type {
	Types[t.Extension] = t
	return t
}

// Get retrieves a Type by extension
func Get(ext string) Type {
	kind := Types[ext]
	if kind.Extension != "" {
		return kind
	}
	return Unknown
}
