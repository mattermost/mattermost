// Copyright © 2016 Steve Francia <spf@spf13.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

package jwalterweatherman

import (
	"fmt"
	"io"
	"log"
	"os"
)

type Threshold int

func (t Threshold) String() string {
	return prefixes[t]
}

const (
	LevelTrace Threshold = iota
	LevelDebug
	LevelInfo
	LevelWarn
	LevelError
	LevelCritical
	LevelFatal
)

var prefixes map[Threshold]string = map[Threshold]string{
	LevelTrace:    "TRACE",
	LevelDebug:    "DEBUG",
	LevelInfo:     "INFO",
	LevelWarn:     "WARN",
	LevelError:    "ERROR",
	LevelCritical: "CRITICAL",
	LevelFatal:    "FATAL",
}

func prefix(t Threshold) string {
	return t.String() + " "
}

// Notepad is where you leave a note !
type Notepad struct {
	TRACE    *log.Logger
	DEBUG    *log.Logger
	INFO     *log.Logger
	WARN     *log.Logger
	ERROR    *log.Logger
	CRITICAL *log.Logger
	FATAL    *log.Logger

	LOG      *log.Logger
	FEEDBACK *Feedback

	loggers         []**log.Logger
	logHandle       io.Writer
	outHandle       io.Writer
	logThreshold    Threshold
	stdoutThreshold Threshold
	prefix          string
	flags           int

	// One per Threshold
	logCounters [7]*logCounter
}

// NewNotepad create a new notepad.
func NewNotepad(outThreshold Threshold, logThreshold Threshold, outHandle, logHandle io.Writer, prefix string, flags int) *Notepad {
	n := &Notepad{}

	n.loggers = append(n.loggers, &n.TRACE, &n.DEBUG, &n.INFO, &n.WARN, &n.ERROR, &n.CRITICAL, &n.FATAL)
	n.logHandle = logHandle
	n.outHandle = outHandle
	n.logThreshold = logThreshold
	n.stdoutThreshold = outThreshold

	if len(prefix) != 0 {
		n.prefix = "[" + prefix + "] "
	} else {
		n.prefix = ""
	}

	n.flags = flags

	n.LOG = log.New(n.logHandle,
		"LOG:   ",
		n.flags)

	n.FEEDBACK = &Feedback{n}

	n.init()

	return n
}

// Feedback is special. It writes plainly to the output while
// logging with the standard extra information (date, file, etc)
// Only Println and Printf are currently provided for this
type Feedback struct {
	*Notepad
}

// init create the loggers for each level depending on the notepad thresholds
func (n *Notepad) init() {
	bothHandle := io.MultiWriter(n.outHandle, n.logHandle)

	for t, logger := range n.loggers {
		threshold := Threshold(t)
		counter := &logCounter{}
		n.logCounters[t] = counter

		switch {
		case threshold >= n.logThreshold && threshold >= n.stdoutThreshold:
			*logger = log.New(io.MultiWriter(counter, bothHandle), n.prefix+prefix(threshold), n.flags)

		case threshold >= n.logThreshold:
			*logger = log.New(io.MultiWriter(counter, n.logHandle), n.prefix+prefix(threshold), n.flags)

		case threshold >= n.stdoutThreshold:
			*logger = log.New(io.MultiWriter(counter, os.Stdout), n.prefix+prefix(threshold), n.flags)

		default:
			*logger = log.New(counter, n.prefix+prefix(threshold), n.flags)
		}
	}
}

// SetLogThreshold change the threshold above which messages are written to the
// log file
func (n *Notepad) SetLogThreshold(threshold Threshold) {
	n.logThreshold = threshold
	n.init()
}

// SetLogOutput change the file where log messages are written
func (n *Notepad) SetLogOutput(handle io.Writer) {
	n.logHandle = handle
	n.init()
}

// GetStdoutThreshold returns the defined Treshold for the log logger.
func (n *Notepad) GetLogThreshold() Threshold {
	return n.logThreshold
}

// SetStdoutThreshold change the threshold above which messages are written to the
// standard output
func (n *Notepad) SetStdoutThreshold(threshold Threshold) {
	n.stdoutThreshold = threshold
	n.init()
}

// GetStdoutThreshold returns the Treshold for the stdout logger.
func (n *Notepad) GetStdoutThreshold() Threshold {
	return n.stdoutThreshold
}

// SetPrefix change the prefix used by the notepad. Prefixes are displayed between
// brackets at the begining of the line. An empty prefix won't be displayed at all.
func (n *Notepad) SetPrefix(prefix string) {
	if len(prefix) != 0 {
		n.prefix = "[" + prefix + "] "
	} else {
		n.prefix = ""
	}
	n.init()
}

// SetFlags choose which flags the logger will display (after prefix and message
// level). See the package log for more informations on this.
func (n *Notepad) SetFlags(flags int) {
	n.flags = flags
	n.init()
}

// Feedback is special. It writes plainly to the output while
// logging with the standard extra information (date, file, etc)
// Only Println and Printf are currently provided for this
func (fb *Feedback) Println(v ...interface{}) {
	s := fmt.Sprintln(v...)
	fmt.Print(s)
	fb.LOG.Output(2, s)
}

// Feedback is special. It writes plainly to the output while
// logging with the standard extra information (date, file, etc)
// Only Println and Printf are currently provided for this
func (fb *Feedback) Printf(format string, v ...interface{}) {
	s := fmt.Sprintf(format, v...)
	fmt.Print(s)
	fb.LOG.Output(2, s)
}
