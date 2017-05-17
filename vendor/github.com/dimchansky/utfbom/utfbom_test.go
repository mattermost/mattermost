package utfbom

import (
	"io"
	"io/ioutil"
	"reflect"
	"testing"
	"testing/iotest"
	"time"
)

var testCases = []struct {
	name       string
	input      []byte
	inputError error
	encoding   Encoding
	output     []byte
}{
	{"1", []byte{}, nil, Unknown, []byte{}},
	{"2", []byte("hello"), nil, Unknown, []byte("hello")},
	{"3", []byte("\xEF\xBB\xBF"), nil, UTF8, []byte{}},
	{"4", []byte("\xEF\xBB\xBFhello"), nil, UTF8, []byte("hello")},
	{"5", []byte("\xFE\xFF"), nil, UTF16BigEndian, []byte{}},
	{"6", []byte("\xFF\xFE"), nil, UTF16LittleEndian, []byte{}},
	{"7", []byte("\x00\x00\xFE\xFF"), nil, UTF32BigEndian, []byte{}},
	{"8", []byte("\xFF\xFE\x00\x00"), nil, UTF32LittleEndian, []byte{}},
	{"5", []byte("\xFE\xFF\x00\x68\x00\x65\x00\x6C\x00\x6C\x00\x6F"), nil,
		UTF16BigEndian, []byte{0x00, 0x68, 0x00, 0x65, 0x00, 0x6C, 0x00, 0x6C, 0x00, 0x6F}},
	{"6", []byte("\xFF\xFE\x68\x00\x65\x00\x6C\x00\x6C\x00\x6F\x00"), nil,
		UTF16LittleEndian, []byte{0x68, 0x00, 0x65, 0x00, 0x6C, 0x00, 0x6C, 0x00, 0x6F, 0x00}},
	{"7", []byte("\x00\x00\xFE\xFF\x00\x00\x00\x68\x00\x00\x00\x65\x00\x00\x00\x6C\x00\x00\x00\x6C\x00\x00\x00\x6F"), nil,
		UTF32BigEndian,
		[]byte{0x00, 0x00, 0x00, 0x68, 0x00, 0x00, 0x00, 0x65, 0x00, 0x00, 0x00, 0x6C, 0x00, 0x00, 0x00, 0x6C, 0x00, 0x00, 0x00, 0x6F}},
	{"8", []byte("\xFF\xFE\x00\x00\x68\x00\x00\x00\x65\x00\x00\x00\x6C\x00\x00\x00\x6C\x00\x00\x00\x6F\x00\x00\x00"), nil,
		UTF32LittleEndian,
		[]byte{0x68, 0x00, 0x00, 0x00, 0x65, 0x00, 0x00, 0x00, 0x6C, 0x00, 0x00, 0x00, 0x6C, 0x00, 0x00, 0x00, 0x6F, 0x00, 0x00, 0x00}},
	{"9", []byte("\xEF"), nil, Unknown, []byte("\xEF")},
	{"10", []byte("\xEF\xBB"), nil, Unknown, []byte("\xEF\xBB")},
	{"11", []byte("\xEF\xBB\xBF"), io.ErrClosedPipe, UTF8, []byte{}},
	{"12", []byte("\xFE\xFF"), io.ErrClosedPipe, Unknown, []byte("\xFE\xFF")},
	{"13", []byte("\xFE"), io.ErrClosedPipe, Unknown, []byte("\xFE")},
	{"14", []byte("\xFF\xFE"), io.ErrClosedPipe, Unknown, []byte("\xFF\xFE")},
	{"15", []byte("\x00\x00\xFE\xFF"), io.ErrClosedPipe, UTF32BigEndian, []byte{}},
	{"16", []byte("\x00\x00\xFE"), io.ErrClosedPipe, Unknown, []byte{0x00, 0x00, 0xFE}},
	{"17", []byte("\x00\x00"), io.ErrClosedPipe, Unknown, []byte{0x00, 0x00}},
	{"18", []byte("\x00"), io.ErrClosedPipe, Unknown, []byte{0x00}},
	{"19", []byte("\xFF\xFE\x00\x00"), io.ErrClosedPipe, UTF32LittleEndian, []byte{}},
	{"20", []byte("\xFF\xFE\x00"), io.ErrClosedPipe, Unknown, []byte{0xFF, 0xFE, 0x00}},
	{"21", []byte("\xFF\xFE"), io.ErrClosedPipe, Unknown, []byte{0xFF, 0xFE}},
	{"22", []byte("\xFF"), io.ErrClosedPipe, Unknown, []byte{0xFF}},
	{"23", []byte("\x68\x65"), nil, Unknown, []byte{0x68, 0x65}},
}

type sliceReader struct {
	input      []byte
	inputError error
}

func (r *sliceReader) Read(p []byte) (n int, err error) {
	if len(p) == 0 {
		return
	}

	if err = r.getError(); err != nil {
		return
	}

	n = copy(p, r.input)
	r.input = r.input[n:]
	err = r.getError()
	return
}

func (r *sliceReader) getError() (err error) {
	if len(r.input) == 0 {
		if r.inputError == nil {
			err = io.EOF
		} else {
			err = r.inputError
		}
	}
	return
}

var readMakers = []struct {
	name string
	fn   func(io.Reader) io.Reader
}{
	{"full", func(r io.Reader) io.Reader { return r }},
	{"byte", iotest.OneByteReader},
}

func TestSkip(t *testing.T) {
	for _, tc := range testCases {
		for _, readMaker := range readMakers {
			r := readMaker.fn(&sliceReader{tc.input, tc.inputError})

			sr, enc := Skip(r)
			if enc != tc.encoding {
				t.Fatalf("test %v reader=%s: expected encoding %v, but got %v", tc.name, readMaker.name, tc.encoding, enc)
			}

			output, err := ioutil.ReadAll(sr)
			if !reflect.DeepEqual(output, tc.output) {
				t.Fatalf("test %v reader=%s: expected to read %+#v, but got %+#v", tc.name, readMaker.name, tc.output, output)
			}
			if err != tc.inputError {
				t.Fatalf("test %v reader=%s: expected to get %+#v error, but got %+#v", tc.name, readMaker.name, tc.inputError, err)
			}
		}
	}
}

func TestSkipSkip(t *testing.T) {
	for _, tc := range testCases {
		for _, readMaker := range readMakers {
			r := readMaker.fn(&sliceReader{tc.input, tc.inputError})

			sr0, _ := Skip(r)
			sr, enc := Skip(sr0)
			if enc != Unknown {
				t.Fatalf("test %v reader=%s: expected encoding %v, but got %v", tc.name, readMaker.name, Unknown, enc)
			}

			output, err := ioutil.ReadAll(sr)
			if !reflect.DeepEqual(output, tc.output) {
				t.Fatalf("test %v reader=%s: expected to read %+#v, but got %+#v", tc.name, readMaker.name, tc.output, output)
			}
			if err != tc.inputError {
				t.Fatalf("test %v reader=%s: expected to get %+#v error, but got %+#v", tc.name, readMaker.name, tc.inputError, err)
			}
		}
	}
}

func TestSkipOnly(t *testing.T) {
	for _, tc := range testCases {
		for _, readMaker := range readMakers {
			r := readMaker.fn(&sliceReader{tc.input, tc.inputError})

			sr := SkipOnly(r)

			output, err := ioutil.ReadAll(sr)
			if !reflect.DeepEqual(output, tc.output) {
				t.Fatalf("test %v reader=%s: expected to read %+#v, but got %+#v", tc.name, readMaker.name, tc.output, output)
			}
			if err != tc.inputError {
				t.Fatalf("test %v reader=%s: expected to get %+#v error, but got %+#v", tc.name, readMaker.name, tc.inputError, err)
			}
		}
	}
}

type zeroReader struct{}

func (zeroReader) Read(p []byte) (int, error) {
	return 0, nil
}

type readerEncoding struct {
	Rd  *Reader
	Enc Encoding
}

func TestSkipZeroReader(t *testing.T) {
	var z zeroReader

	c := make(chan readerEncoding)
	go func() {
		r, enc := Skip(z)
		c <- readerEncoding{r, enc}
	}()

	select {
	case re := <-c:
		if re.Enc != Unknown {
			t.Error("Unknown encoding expected")
		} else {
			var b [1]byte
			n, err := re.Rd.Read(b[:])
			if n != 0 {
				t.Error("unexpected bytes count:", n)
			}
			if err != io.ErrNoProgress {
				t.Error("unexpected error:", err)
			}
		}
	case <-time.After(time.Second):
		t.Error("test timed out (endless loop in Skip?)")
	}
}

func TestSkipOnlyZeroReader(t *testing.T) {
	var z zeroReader

	c := make(chan *Reader)
	go func() {
		r := SkipOnly(z)
		c <- r
	}()

	select {
	case r := <-c:
		var b [1]byte
		n, err := r.Read(b[:])
		if n != 0 {
			t.Error("unexpected bytes count:", n)
		}
		if err != io.ErrNoProgress {
			t.Error("unexpected error:", err)
		}
	case <-time.After(time.Second):
		t.Error("test timed out (endless loop in Skip?)")
	}
}

func TestReader_ReadEmpty(t *testing.T) {
	for _, tc := range testCases {
		for _, readMaker := range readMakers {
			r := readMaker.fn(&sliceReader{tc.input, tc.inputError})

			sr := SkipOnly(r)

			n, err := sr.Read(nil)
			if n != 0 {
				t.Fatalf("test %v reader=%s: expected to read zero bytes, but got %v", tc.name, readMaker.name, n)
			}
			if err != nil {
				t.Fatalf("test %v reader=%s: expected to get <nil> error, but got %+#v", tc.name, readMaker.name, err)
			}
		}
	}
}
