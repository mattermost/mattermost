// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"io"
)

// logReadBlockSize is how much of the log file is read per call when scanning it backwards.
const logReadBlockSize = 64 * 1024

// reverseLineReader returns the lines of a file from last to first, reading it in fixed-size
// blocks from the end. Lines are split as GetLogsSkipSend has always split them: every line but
// the first in the file starts with the '\n' that precedes it.
type reverseLineReader struct {
	r         io.ReaderAt
	blockSize int
	// buf backs data; it only grows past two blocks for a line longer than a block.
	buf []byte
	// data holds the bytes [offset, offset+len(data)) of the file that have not been returned yet.
	data   []byte
	offset int64
}

// newReverseLineReader returns a reader for the lines in the first size bytes of r.
func newReverseLineReader(r io.ReaderAt, size int64, blockSize int) *reverseLineReader {
	return &reverseLineReader{
		r:         r,
		blockSize: blockSize,
		offset:    size,
	}
}

// Next returns the line before the one it last returned, or io.EOF once the start of the file has
// been reached. The returned slice is only valid until the next call.
func (lr *reverseLineReader) Next() ([]byte, error) {
	// the bytes of data from unsearched on hold no '\n', which keeps a long line from being
	// searched again for every block read
	unsearched := len(lr.data)
	for {
		if i := bytes.LastIndexByte(lr.data[:unsearched], '\n'); i >= 0 {
			line := lr.data[i:]
			lr.data = lr.data[:i]
			return line, nil
		}

		if lr.offset == 0 {
			if len(lr.data) == 0 {
				return nil, io.EOF
			}
			line := lr.data
			lr.data = nil
			return line, nil
		}

		n, err := lr.readBlock()
		if err != nil {
			return nil, err
		}
		unsearched = n
	}
}

// readBlock prepends the block that precedes data in the file to data and returns its length.
// Blocks grow with data so that a line spanning many blocks is not moved once per block.
func (lr *reverseLineReader) readBlock() (int, error) {
	n := int(min(int64(max(lr.blockSize, len(lr.data))), lr.offset))
	size := n + len(lr.data)
	if size > cap(lr.buf) {
		lr.buf = make([]byte, max(size, 2*lr.blockSize, 2*cap(lr.buf)))
	}

	// data may already live in buf, which copy handles.
	buf := lr.buf[:size]
	copy(buf[n:], lr.data)
	if read, err := lr.r.ReadAt(buf[:n], lr.offset-int64(n)); read < n {
		// the file shrank since its size was taken; io.EOF would read as having reached its start
		if err == io.EOF {
			err = io.ErrUnexpectedEOF
		}
		return 0, err
	}

	lr.data = buf
	lr.offset -= int64(n)
	return n, nil
}
