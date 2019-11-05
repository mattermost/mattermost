package types

// MIME stores the file MIME type values
type MIME struct {
	Type    string
	Subtype string
	Value   string
}

// Creates a new MIME type
func NewMIME(mime string) MIME {
	kind, subtype := splitMime(mime)
	return MIME{Type: kind, Subtype: subtype, Value: mime}
}
