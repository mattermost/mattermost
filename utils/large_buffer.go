// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"bytes"
	"encoding/ascii85"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
)

const initialMemoryBuffer = 2 * 1024 * 1024 // 2Mb

type tempFileEncoding interface {
	NewEncoder(io.Writer) io.WriteCloser
	NewDecoder(io.Reader) io.Reader
}

type ascii85Encoding struct{}

func (e *ascii85Encoding) NewEncoder(w io.Writer) io.WriteCloser {
	return ascii85.NewEncoder(w)
}
func (e *ascii85Encoding) NewDecoder(r io.Reader) io.Reader {
	return ascii85.NewDecoder(r)
}
func (e ascii85Encoding) String() string {
	return "ascii85"
}

type base64Encoding struct{}

func (e *base64Encoding) NewEncoder(w io.Writer) io.WriteCloser {
	return base64.NewEncoder(base64.StdEncoding, w)
}
func (e *base64Encoding) NewDecoder(r io.Reader) io.Reader {
	return base64.NewDecoder(base64.StdEncoding, r)
}
func (e base64Encoding) String() string {
	return "base64"
}

var ascii85Enc = &ascii85Encoding{}
var base64Enc = &base64Encoding{}
var tempFileEncodings = map[string]tempFileEncoding{
	ascii85Enc.String(): ascii85Enc,
	base64Enc.String():  base64Enc,
}

var ErrLargeBufferMustClose = errors.New("LargeBuffer must be Closed before reading from file")

// TODO: consider using https://github.com/djherbis/buffer for better performance

// Type LargeBuffer implements a buffer backed by a bytes.Buffer up to
// maxMemoryBuffer bytes. It uses a temporary file for any extra payload bytes.
// The file can be optionally encoded to alleviate concerns about saving
// maliciopus contents to disk.
//
// NewReadCloser returns the stream for the entire payload. However, clients
// should not Read beyond what's buffered in memory until the LargeBuffer is
// closed for writing.  Doing so will return in ErrLargeBufferMustClose.  The
// reason for this is that encodings work in 4-byte chunks and require
// flushing, when the tempFile is closed.
//
// Close flushes the encoding, and closes the file for writing. Remove deletes
// the file and unreferences the in-memory buffer.
type LargeBuffer struct {
	maxMemoryBuffer  int
	tempFileEncoding tempFileEncoding
	tempFileName     string

	buffer    *bytes.Buffer
	writeFile *os.File
	encoder   io.WriteCloser
	out       io.Writer
}

var _ io.WriteCloser = (*LargeBuffer)(nil)

func NewLargeBuffer(maxMemoryBuffer int, enc string) *LargeBuffer {
	if maxMemoryBuffer < 0 {
		maxMemoryBuffer = 0
	}

	lbuf := &LargeBuffer{
		maxMemoryBuffer:  maxMemoryBuffer,
		buffer:           &bytes.Buffer{},
		tempFileEncoding: tempFileEncodings[enc],
	}

	// Pre-grow the buffer for optimal performance
	lbuf.buffer.Grow(initialMemoryBuffer)

	return lbuf
}

func NewLargeBufferFrom(buffered []byte, tempFileName string, enc string) *LargeBuffer {
	lbuf := &LargeBuffer{}
	lbuf.InitFrom(buffered, tempFileName, enc)
	return lbuf
}

func (lbuf *LargeBuffer) InitFrom(buffered []byte, tempFileName string, enc string) {
	lbuf.Clear()
	lbuf.maxMemoryBuffer = len(buffered)
	lbuf.buffer = bytes.NewBuffer(buffered)
	lbuf.tempFileName = tempFileName
	lbuf.tempFileEncoding = tempFileEncodings[enc]
}

func (lbuf *LargeBuffer) Bytes() []byte {
	if lbuf.buffer == nil {
		return []byte{}
	}
	return lbuf.buffer.Bytes()
}

func (lbuf *LargeBuffer) TempFileEncoding() string {
	if lbuf.tempFileEncoding != nil {
		stringer := lbuf.tempFileEncoding.(fmt.Stringer)
		if stringer != nil {
			return stringer.String()
		}
	}
	return ""
}

func (lbuf *LargeBuffer) TempFileName() string {
	return lbuf.tempFileName
}

func (lbuf LargeBuffer) IsEmpty() bool {
	return lbuf.tempFileName == "" && (lbuf.buffer == nil || lbuf.buffer.Len() == 0)
}

func (lbuf LargeBuffer) IsClosed() bool {
	return lbuf.tempFileName != "" && lbuf.writeFile == nil
}

func (lbuf *LargeBuffer) NewReadCloser() (io.ReadCloser, error) {
	r := &largeBufferReader{
		lbuf:         lbuf,
		memoryReader: bytes.NewReader(lbuf.buffer.Bytes()),
	}

	return r, nil
}

func (lbuf *LargeBuffer) Write(p []byte) (written int, err error) {
	if lbuf.IsClosed() {
		return 0, fmt.Errorf("Attempted to Write into a closed LargeBuffer.")
	}

	memSize := lbuf.maxMemoryBuffer - lbuf.buffer.Len()
	if memSize > 0 {
		if memSize > len(p) {
			memSize = len(p)
		}
		n, err := lbuf.buffer.Write(p[:memSize])
		written += n
		if err != nil {
			return written, err
		}
		p = p[memSize:]
	}
	if len(p) == 0 {
		return written, nil
	}

	if lbuf.out == nil {
		file, err := ioutil.TempFile("", "mattermost-upload-*.tmp")
		if err != nil {
			return written, err
		}

		lbuf.tempFileName = file.Name()
		lbuf.writeFile = file
		lbuf.out = file
		if lbuf.tempFileEncoding != nil {
			lbuf.encoder = lbuf.tempFileEncoding.NewEncoder(file)
			lbuf.out = lbuf.encoder
		}
	}

	n, err := lbuf.out.Write(p)
	written += n
	return written, err
}

func (lbuf *LargeBuffer) Close() error {
	if lbuf.out == nil {
		return nil
	}
	if lbuf.encoder != nil {
		err := lbuf.encoder.Close()
		if err != nil {
			return err
		}
		lbuf.encoder = nil
	}
	if lbuf.writeFile != nil {
		err := lbuf.writeFile.Close()
		if err != nil {
			return err
		}
		lbuf.writeFile = nil
	}
	lbuf.out = nil
	return nil
}

func (lbuf *LargeBuffer) Clear() error {
	err := lbuf.Close()
	if err != nil {
		return err
	}
	if lbuf.tempFileName != "" {
		err := os.Remove(lbuf.tempFileName)
		if err != nil {
			return err
		}
		lbuf.tempFileName = ""
	}
	// Reset the buffer in case there are stray readers, and trash it to GC.
	if lbuf.buffer != nil {
		lbuf.buffer.Reset()
	}
	lbuf.buffer = &bytes.Buffer{}
	return nil
}

type largeBufferReader struct {
	lbuf         *LargeBuffer
	memoryReader io.Reader
	fileReader   io.Reader
	closer       io.Closer
	read         int64
	count        int
	lastLogged   int64
}

func (r *largeBufferReader) Read(p []byte) (bytesRead int, err error) {
	defer func() {
		r.read += int64(bytesRead)
		r.count++
	}()

	nmem, err := r.memoryReader.Read(p)
	switch {
	case err != nil && err != io.EOF:
		return nmem, err
	case nmem == len(p):
		return nmem, nil
	case r.lbuf.tempFileName == "":
		return nmem, io.EOF
	case !r.lbuf.IsClosed():
		return nmem, ErrLargeBufferMustClose
	}

	// Continue reading from the temp file, the first time open it.
	if r.fileReader == nil {
		file, err := os.Open(r.lbuf.tempFileName)
		if err != nil {
			return nmem, err
		}

		r.fileReader = file
		if r.lbuf.tempFileEncoding != nil {
			r.fileReader = r.lbuf.tempFileEncoding.NewDecoder(file)
		}
		r.closer = file
	}

	nfile, err := r.fileReader.Read(p[nmem:])
	return nmem + nfile, err
}

func (r *largeBufferReader) Close() error {
	c := r.closer
	r.fileReader = nil
	r.closer = nil
	if c == nil {
		return nil
	}
	err := c.Close()
	return err
}

type LimitedReader struct {
	R            io.Reader // underlying reader
	N            int64     // max bytes remaining
	LimitReached func(l *LimitedReader) error
	BytesRead    int64
}

func (l *LimitedReader) Read(p []byte) (int, error) {
	if l.N <= 0 {
		err := io.EOF
		if l.LimitReached != nil {
			err = l.LimitReached(l)

		}
		return 0, err
	}

	if int64(len(p)) > l.N {
		p = p[0:l.N]
	}
	n, err := l.R.Read(p)
	l.N -= int64(n)
	l.BytesRead += int64(n)
	return n, err
}
