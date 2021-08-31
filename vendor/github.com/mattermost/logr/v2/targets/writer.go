package targets

import (
	"io"
	"io/ioutil"

	"github.com/mattermost/logr/v2"
)

// Writer outputs log records to any `io.Writer`.
type Writer struct {
	out io.Writer
}

// NewWriterTarget creates a target capable of outputting log records to an io.Writer.
func NewWriterTarget(out io.Writer) *Writer {
	if out == nil {
		out = ioutil.Discard
	}
	w := &Writer{out: out}
	return w
}

// Init is called once to initialize the target.
func (w *Writer) Init() error {
	return nil
}

// Write outputs bytes to this file target.
func (w *Writer) Write(p []byte, rec *logr.LogRec) (int, error) {
	return w.out.Write(p)
}

// Shutdown is called once to free/close any resources.
// Target queue is already drained when this is called.
func (w *Writer) Shutdown() error {
	return nil
}
