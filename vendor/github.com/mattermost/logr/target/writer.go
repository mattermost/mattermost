package target

import (
	"io"
	"io/ioutil"

	"github.com/mattermost/logr"
)

// Writer outputs log records to any `io.Writer`.
type Writer struct {
	logr.Basic
	out io.Writer
}

// NewWriterTarget creates a target capable of outputting log records to an io.Writer.
func NewWriterTarget(filter logr.Filter, formatter logr.Formatter, out io.Writer, maxQueue int) *Writer {
	if out == nil {
		out = ioutil.Discard
	}
	w := &Writer{out: out}
	w.Basic.Start(w, w, filter, formatter, maxQueue)
	return w
}

// Write converts the log record to bytes, via the Formatter,
// and outputs to the io.Writer.
func (w *Writer) Write(rec *logr.LogRec) error {
	_, stacktrace := w.IsLevelEnabled(rec.Level())

	buf := rec.Logger().Logr().BorrowBuffer()
	defer rec.Logger().Logr().ReleaseBuffer(buf)

	buf, err := w.Formatter().Format(rec, stacktrace, buf)
	if err != nil {
		return err
	}
	_, err = w.out.Write(buf.Bytes())
	return err
}
