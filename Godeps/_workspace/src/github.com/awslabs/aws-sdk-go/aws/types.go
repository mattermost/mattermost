package aws

import (
	"io"
	"time"
)

// String converts a Go string into a string pointer.
func String(v string) *string {
	return &v
}

// Boolean converts a Go bool into a boolean pointer.
func Boolean(v bool) *bool {
	return &v
}

// Long converts a Go int64 into a long pointer.
func Long(v int64) *int64 {
	return &v
}

// Double converts a Go float64 into a double pointer.
func Double(v float64) *float64 {
	return &v
}

// Time converts a Go Time into a Time pointer
func Time(t time.Time) *time.Time {
	return &t
}

func ReadSeekCloser(r io.Reader) ReaderSeekerCloser {
	return ReaderSeekerCloser{r}
}

type ReaderSeekerCloser struct {
	r io.Reader
}

func (r ReaderSeekerCloser) Read(p []byte) (int, error) {
	switch t := r.r.(type) {
	case io.Reader:
		return t.Read(p)
	}
	return 0, nil
}

func (r ReaderSeekerCloser) Seek(offset int64, whence int) (int64, error) {
	switch t := r.r.(type) {
	case io.Seeker:
		return t.Seek(offset, whence)
	}
	return int64(0), nil
}

func (r ReaderSeekerCloser) Close() error {
	switch t := r.r.(type) {
	case io.Closer:
		return t.Close()
	}
	return nil
}
