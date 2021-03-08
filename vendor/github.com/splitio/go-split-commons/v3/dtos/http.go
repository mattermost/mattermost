package dtos

// HTTPError represents a http error
type HTTPError struct {
	Code    int
	Message string
}

// Error implements golang error interface
func (h HTTPError) Error() string {
	return h.Message
}
