package exif

import (
	"io"
)

type readerToReaderAt struct {
	reader io.Reader
	buffer []byte
}

func (r *readerToReaderAt) ReadAt(p []byte, start int64) (n int, err error) {
	end := start + int64(len(p))
	n = 0
	l := len(r.buffer)
	if end > int64(l) {
		new := make([]byte, end-int64(l))
		n, err = r.reader.Read(new)
		if err == io.EOF {
			err = nil
		}
		r.buffer = append(r.buffer, new[:n]...)
	}
	if end > int64(len(r.buffer)) {
		end = int64(len(r.buffer))
	}
	n = copy(p[:], r.buffer[start:end])
	return
}
