package merror

// MError represents zero or more errors that can be
// accumulated via the `Append` method.
type MError struct {
	cap       int
	errors    []error
	overflow  int
	formatter FormatterFunc
}

// New returns a new instance of `MError` with no limit on the
// number of errors that can be appended.
func New() *MError {
	me := &MError{}
	me.errors = make([]error, 0, 10)
	return me
}

// NewWithCap returns a new instance of `MError` with a maximum
// capacity of `cap` errors. If exceeded only the overflow counter
// will be incremented.
//
// A `cap` of zero of less means no cap and max size of a slice
// on the current platform is the upper bound.
func NewWithCap(cap int) *MError {
	me := New()
	me.cap = cap
	return me
}

// Append adds an error to the aggregated error list.
func (me *MError) Append(err error) {
	if err == nil {
		return
	}
	if me.cap > 0 && len(me.errors) >= me.cap {
		me.overflow++
	} else {
		me.errors = append(me.errors, err)
	}
}

// Errors returns an array of the `error` instances that have been
// appended to this `MError`.
func (me *MError) Errors() []error {
	return me.errors
}

// Len returns the number of errors that have been appended.
func (me *MError) Len() int {
	return len(me.errors)
}

// Overflow returns the number of errors that have been truncated
// because maximum capacity was exceeded.
func (me *MError) Overflow() int {
	return me.overflow
}

// SetFormatter sets the `FormatterFunc` to be used when `Error` is
// called. The previous `FormatterFunc` is returned.
func (me *MError) SetFormatter(f FormatterFunc) (old FormatterFunc) {
	old = me.formatter
	me.formatter = f
	return
}

// ErrorOrNil returns nil if this `MError` contains no errors,
// otherwise this `MError` is returned.
func (me *MError) ErrorOrNil() error {
	if me == nil || len(me.errors) == 0 {
		return nil
	}
	return me
}

// Error returns a string representation of this MError.
// The output format depends on the `Formatter` set for this
// merror instance, or the global formatter if none set.
func (me *MError) Error() string {
	f := me.formatter
	if f == nil {
		f = GlobalFormatter
	}
	return f(me)
}
