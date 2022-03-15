package errors

import (
	"github.com/pkg/errors"
)

// ErrNotFound is returned by the plugin API when an object is not found.
var ErrNotFound = errors.New("not found")
