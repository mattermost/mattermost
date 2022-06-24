/*
 * MinIO Go Library for Amazon S3 Compatible Cloud Storage
 * Copyright 2021 MinIO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package minio

import (
	"archive/tar"
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/klauspost/compress/s2"
)

// SnowballOptions contains options for PutObjectsSnowball calls.
type SnowballOptions struct {
	// Opts is options applied to all objects.
	Opts PutObjectOptions

	// Processing options:

	// InMemory specifies that all objects should be collected in memory
	// before they are uploaded.
	// If false a temporary file will be created.
	InMemory bool

	// Compress enabled content compression before upload.
	// Compression will typically reduce memory and network usage,
	// Compression can safely be enabled with MinIO hosts.
	Compress bool
}

// SnowballObject contains information about a single object to be added to the snowball.
type SnowballObject struct {
	// Key is the destination key, including prefix.
	Key string

	// Size is the content size of this object.
	Size int64

	// Modtime to apply to the object.
	ModTime time.Time

	// Content of the object.
	// Exactly 'Size' number of bytes must be provided.
	Content io.Reader

	// Close will be called when an object has finished processing.
	// Note that if PutObjectsSnowball returns because of an error,
	// objects not consumed from the input will NOT have been closed.
	// Leave as nil for no callback.
	Close func()
}

type nopReadSeekCloser struct {
	io.ReadSeeker
}

func (n nopReadSeekCloser) Close() error {
	return nil
}

// This is available as io.ReadSeekCloser from go1.16
type readSeekCloser interface {
	io.Reader
	io.Closer
	io.Seeker
}

// PutObjectsSnowball will put multiple objects with a single put call.
// A (compressed) TAR file will be created which will contain multiple objects.
// The key for each object will be used for the destination in the specified bucket.
// Total size should be < 5TB.
// This function blocks until 'objs' is closed and the content has been uploaded.
func (c Client) PutObjectsSnowball(ctx context.Context, bucketName string, opts SnowballOptions, objs <-chan SnowballObject) (err error) {
	err = opts.Opts.validate()
	if err != nil {
		return err
	}
	var tmpWriter io.Writer
	var getTmpReader func() (rc readSeekCloser, sz int64, err error)
	if opts.InMemory {
		b := bytes.NewBuffer(nil)
		tmpWriter = b
		getTmpReader = func() (readSeekCloser, int64, error) {
			return nopReadSeekCloser{bytes.NewReader(b.Bytes())}, int64(b.Len()), nil
		}
	} else {
		f, err := ioutil.TempFile("", "s3-putsnowballobjects-*")
		if err != nil {
			return err
		}
		name := f.Name()
		tmpWriter = f
		var once sync.Once
		defer once.Do(func() {
			f.Close()
		})
		defer os.Remove(name)
		getTmpReader = func() (readSeekCloser, int64, error) {
			once.Do(func() {
				f.Close()
			})
			f, err := os.Open(name)
			if err != nil {
				return nil, 0, err
			}
			st, err := f.Stat()
			if err != nil {
				return nil, 0, err
			}
			return f, st.Size(), nil
		}
	}
	flush := func() error { return nil }
	if !opts.Compress {
		if !opts.InMemory {
			// Insert buffer for writes.
			buf := bufio.NewWriterSize(tmpWriter, 1<<20)
			flush = buf.Flush
			tmpWriter = buf
		}
	} else {
		s2c := s2.NewWriter(tmpWriter, s2.WriterBetterCompression())
		flush = s2c.Close
		defer s2c.Close()
		tmpWriter = s2c
	}
	t := tar.NewWriter(tmpWriter)

objectLoop:
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case obj, ok := <-objs:
			if !ok {
				break objectLoop
			}

			closeObj := func() {}
			if obj.Close != nil {
				closeObj = obj.Close
			}

			// Trim accidental slash prefix.
			obj.Key = strings.TrimPrefix(obj.Key, "/")
			header := tar.Header{
				Typeflag: tar.TypeReg,
				Name:     obj.Key,
				Size:     obj.Size,
				ModTime:  obj.ModTime,
				Format:   tar.FormatPAX,
			}
			if err := t.WriteHeader(&header); err != nil {
				closeObj()
				return err
			}
			n, err := io.Copy(t, obj.Content)
			if err != nil {
				closeObj()
				return err
			}
			if n != obj.Size {
				closeObj()
				return io.ErrUnexpectedEOF
			}
			closeObj()
		}
	}
	// Flush tar
	err = t.Flush()
	if err != nil {
		return err
	}
	// Flush compression
	err = flush()
	if err != nil {
		return err
	}
	if opts.Opts.UserMetadata == nil {
		opts.Opts.UserMetadata = map[string]string{}
	}
	opts.Opts.UserMetadata["X-Amz-Meta-Snowball-Auto-Extract"] = "true"
	opts.Opts.DisableMultipart = true
	rc, sz, err := getTmpReader()
	if err != nil {
		return err
	}
	defer rc.Close()
	rand := c.random.Uint64()
	_, err = c.PutObject(ctx, bucketName, fmt.Sprintf("snowball-upload-%x.tar", rand), rc, sz, opts.Opts)
	return err
}
