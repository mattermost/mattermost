package targets

import (
	"errors"
	"io"

	"github.com/mattermost/logr/v2"
	"gopkg.in/natefinch/lumberjack.v2"
)

type FileOptions struct {
	// Filename is the file to write logs to.  Backup log files will be retained
	// in the same directory.  It uses <processname>-lumberjack.log in
	// os.TempDir() if empty.
	Filename string `json:"filename"`

	// MaxSize is the maximum size in megabytes of the log file before it gets
	// rotated. It defaults to 100 megabytes.
	MaxSize int `json:"max_size"`

	// MaxAge is the maximum number of days to retain old log files based on the
	// timestamp encoded in their filename.  Note that a day is defined as 24
	// hours and may not exactly correspond to calendar days due to daylight
	// savings, leap seconds, etc. The default is not to remove old log files
	// based on age.
	MaxAge int `json:"max_age"`

	// MaxBackups is the maximum number of old log files to retain.  The default
	// is to retain all old log files (though MaxAge may still cause them to get
	// deleted.)
	MaxBackups int `json:"max_backups"`

	// Compress determines if the rotated log files should be compressed
	// using gzip. The default is not to perform compression.
	Compress bool `json:"compress"`
}

func (fo FileOptions) CheckValid() error {
	if fo.Filename == "" {
		return errors.New("filename cannot be empty")
	}
	return nil
}

// File outputs log records to a file which can be log rotated based on size or age.
// Uses `https://github.com/natefinch/lumberjack` for rotation.
type File struct {
	out io.WriteCloser
}

// NewFileTarget creates a target capable of outputting log records to a rotated file.
func NewFileTarget(opts FileOptions) *File {
	lumber := &lumberjack.Logger{
		Filename:   opts.Filename,
		MaxSize:    opts.MaxSize,
		MaxBackups: opts.MaxBackups,
		MaxAge:     opts.MaxAge,
		Compress:   opts.Compress,
	}
	f := &File{out: lumber}
	return f
}

// Init is called once to initialize the target.
func (f *File) Init() error {
	return nil
}

// Write outputs bytes to this file target.
func (f *File) Write(p []byte, rec *logr.LogRec) (int, error) {
	return f.out.Write(p)
}

// Shutdown is called once to free/close any resources.
// Target queue is already drained when this is called.
func (f *File) Shutdown() error {
	return f.out.Close()
}
