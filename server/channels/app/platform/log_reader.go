// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"bytes"
	"encoding/json"
	"io"
	"time"

	"github.com/mattermost/logr/v2"
)

// logReadBlockSize is how much of the log file is read per call when scanning it backwards.
const logReadBlockSize = 64 * 1024

// logSeekProbeSize is how much of the log file each probe of logScanEnd reads.
const logSeekProbeSize = 4 * 1024

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

// logScanEnd returns where a backwards scan for entries no newer than dateTo can stop reading the
// first size bytes of r instead of at size. It binary-searches the file for the first entry newer
// than dateTo, then ends one block later, on a line break, so that entries slightly out of order
// around it are still read. The caller still filters each entry by date.
//
// It returns size, so the whole file is scanned as before, whenever a probe finds no line with a
// timestamp it can parse, or the file can't be read.
func logScanEnd(r io.ReaderAt, size int64, dateTo time.Time, blockSize int) int64 {
	buf := make([]byte, logSeekProbeSize)

	// Every entry that starts after hi is newer than dateTo, or hi is size.
	lo, hi := int64(0), size
	for hi-lo > int64(blockSize) {
		mid := lo + (hi-lo)/2
		timestamp, ok := probeLogTimestamp(r, size, mid, buf)
		if !ok {
			return size
		}
		if timestamp.After(dateTo) {
			hi = mid
		} else {
			lo = mid + 1
		}
	}

	end := hi + int64(blockSize)
	if end >= size {
		return size
	}

	// End on a line break, so that the scan starts with a whole line
	for offset := end; offset < size; offset += int64(len(buf)) {
		n := int(min(int64(len(buf)), size-offset))
		if read, _ := r.ReadAt(buf[:n], offset); read < n {
			return size
		}
		if i := bytes.IndexByte(buf[:n], '\n'); i >= 0 {
			return offset + int64(i)
		}
	}

	return size
}

// probeLogTimestamp returns the timestamp of the first entry that starts at or after offset, in the
// first size bytes of r, and parses within the logSeekProbeSize bytes read into buf.
func probeLogTimestamp(r io.ReaderAt, size, offset int64, buf []byte) (time.Time, bool) {
	n := int(min(int64(len(buf)), size-offset))
	data := buf[:n]
	if read, _ := r.ReadAt(data, offset); read < n {
		return time.Time{}, false
	}
	atEnd := offset+int64(n) == size

	// the line offset falls in may have started before it
	if offset > 0 {
		i := bytes.IndexByte(data, '\n')
		if i < 0 {
			return time.Time{}, false
		}
		data = data[i+1:]
	}

	for len(data) > 0 {
		line := data
		if i := bytes.IndexByte(data, '\n'); i >= 0 {
			line, data = data[:i], data[i+1:]
		} else if atEnd {
			data = nil
		} else {
			// the line goes on past what was read
			break
		}

		var entry struct {
			Timestamp string `json:"timestamp"`
		}
		if json.Unmarshal(line, &entry) != nil {
			continue
		}
		if timestamp, err := time.Parse(logr.DefTimestampFormat, entry.Timestamp); err == nil {
			return timestamp, true
		}
	}

	return time.Time{}, false
}
