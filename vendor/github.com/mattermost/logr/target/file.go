package target

import (
	"context"
	"io"

	"github.com/mattermost/logr"
	"github.com/wiggin77/merror"
	"gopkg.in/natefinch/lumberjack.v2"
)

type FileOptions struct {
	// Filename is the file to write logs to.  Backup log files will be retained
	// in the same directory.  It uses <processname>-lumberjack.log in
	// os.TempDir() if empty.
	Filename string

	// MaxSize is the maximum size in megabytes of the log file before it gets
	// rotated. It defaults to 100 megabytes.
	MaxSize int

	// MaxAge is the maximum number of days to retain old log files based on the
	// timestamp encoded in their filename.  Note that a day is defined as 24
	// hours and may not exactly correspond to calendar days due to daylight
	// savings, leap seconds, etc. The default is not to remove old log files
	// based on age.
	MaxAge int

	// MaxBackups is the maximum number of old log files to retain.  The default
	// is to retain all old log files (though MaxAge may still cause them to get
	// deleted.)
	MaxBackups int

	// Compress determines if the rotated log files should be compressed
	// using gzip. The default is not to perform compression.
	Compress bool
}

// File outputs log records to a file which can be log rotated based on size or age.
// Uses `https://github.com/natefinch/lumberjack` for rotation.
type File struct {
	logr.Basic
	out io.WriteCloser
}

// NewFileTarget creates a target capable of outputting log records to a rotated file.
func NewFileTarget(filter logr.Filter, formatter logr.Formatter, opts FileOptions, maxQueue int) *File {
	lumber := &lumberjack.Logger{
		Filename:   opts.Filename,
		MaxSize:    opts.MaxSize,
		MaxBackups: opts.MaxBackups,
		MaxAge:     opts.MaxAge,
		Compress:   opts.Compress,
	}
	f := &File{out: lumber}
	f.Basic.Start(f, f, filter, formatter, maxQueue)
	return f
}

// Write converts the log record to bytes, via the Formatter,
// and outputs to a file.
func (f *File) Write(rec *logr.LogRec) error {
	_, stacktrace := f.IsLevelEnabled(rec.Level())

	buf := rec.Logger().Logr().BorrowBuffer()
	defer rec.Logger().Logr().ReleaseBuffer(buf)

	buf, err := f.Formatter().Format(rec, stacktrace, buf)
	if err != nil {
		return err
	}
	_, err = f.out.Write(buf.Bytes())
	return err
}

// Shutdown flushes any remaining log records and closes the file.
func (f *File) Shutdown(ctx context.Context) error {
	errs := merror.New()

	err := f.Basic.Shutdown(ctx)
	errs.Append(err)

	err = f.out.Close()
	errs.Append(err)

	return errs.ErrorOrNil()
}
