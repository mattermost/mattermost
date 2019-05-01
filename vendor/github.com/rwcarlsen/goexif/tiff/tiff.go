// Package tiff implements TIFF decoding as defined in TIFF 6.0 specification at
// http://partners.adobe.com/public/developer/en/tiff/TIFF6.pdf
package tiff

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
)

const notValidTIFF = "tiff: invalid TIFF header"

// ReadAtReader is used when decoding Tiff tags and directories
type ReadAtReader interface {
	io.Reader
	io.ReaderAt
}

// Tiff provides access to a decoded tiff data structure.
type Tiff struct {
	// Dirs is an ordered slice of the tiff's Image File Directories (IFDs).
	// The IFD at index 0 is IFD0.
	Dirs []*Dir
	// The tiff's byte-encoding (i.e. big/little endian).
	Order binary.ByteOrder
}

func IsInvalidTiff(err error) bool {
	return err != nil && err.Error() == notValidTIFF
}

// Decode parses tiff-encoded data from r and returns a Tiff struct that
// reflects the structure and content of the tiff data. The first read from r
// should be the first byte of the tiff-encoded data and not necessarily the
// first byte of an os.File object.
func Decode(r io.Reader) (*Tiff, error) {
	data, err := ioutil.ReadAll(r)
	if err != nil {
		return nil, errors.New("tiff: could not read data")
	}
	buf := bytes.NewReader(data)
	t, err := LazyDecode(buf)
	if err != nil {
		return nil, err
	}
	return t.LoadAllVals()
}

// LazyDecode parses tiff-encoded data from r and returns a Tiff struct that
// reflects the structure and content of the tiff data. The first read from r
// should be the first byte of the tiff-encoded data and not necessarily the
// first byte of an os.File object.
//
// It differs from Decode as it is restricted to parsing the tiff structure
// and only decodes the values on demand.
func LazyDecode(r io.ReaderAt) (*Tiff, error) {

	t := new(Tiff)

	// read byte order
	bo := make([]byte, 2)
	if _, err := r.ReadAt(bo, 0); err != nil {
		return nil, errors.New("tiff: could not read tiff byte order")
	}
	if string(bo) == "II" {
		t.Order = binary.LittleEndian
	} else if string(bo) == "MM" {
		t.Order = binary.BigEndian
	} else {
		return nil, errors.New(notValidTIFF)
	}

	// check for special tiff marker
	sp := make([]byte, 2)
	_, err := r.ReadAt(sp, 2)
	if err != nil || 42 != t.Order.Uint16(sp) {
		return nil, errors.New("tiff: could not find special tiff marker")
	}

	// load offset to first IFD
	binaryOffset := make([]byte, 4)
	_, err = r.ReadAt(binaryOffset, 4)
	if err != nil {
		return nil, errors.New("tiff: could not read offset to first IFD")
	}
	offset := t.Order.Uint32(binaryOffset)

	// load IFD's
	var d *Dir
	prev := offset
	for offset != 0 {

		// load the dir
		d, offset, err = DecodeDir(r, t.Order, offset)
		if err != nil {
			return nil, err
		}

		if offset == prev {
			return nil, errors.New("tiff: recursive IFD")
		}
		prev = offset

		t.Dirs = append(t.Dirs, d)
	}

	return t, nil
}

// LoadAllVals loads and parses all tiff directory values in memory
func (t *Tiff) LoadAllVals() (*Tiff, error) {
	for _, d := range t.Dirs {
		for _, tag := range d.Tags {
			err := tag.LoadVal()
			if err != nil {
				return nil, err
			}
		}
	}
	return t, nil
}

func (tf *Tiff) String() string {
	var buf bytes.Buffer
	fmt.Fprint(&buf, "Tiff{")
	for _, d := range tf.Dirs {
		fmt.Fprintf(&buf, "%s, ", d.String())
	}
	fmt.Fprintf(&buf, "}")
	return buf.String()
}

// Dir provides access to the parsed content of a tiff Image File Directory (IFD).
type Dir struct {
	Tags []*Tag
}

// DecodeDir parses a tiff-encoded IFD from r and returns a Dir object.  offset
// is the offset to the next IFD.  The first read from r should be at the first
// byte of the IFD. ReadAt offsets should generally be relative to the
// beginning of the tiff structure (not relative to the beginning of the IFD).
func DecodeDir(r io.ReaderAt, order binary.ByteOrder, offset uint32) (*Dir, uint32, error) {
	d := new(Dir)

	// get num of tags in ifd
	b := make([]byte, 4)
	_, err := r.ReadAt(b[0:2], int64(offset))
	if err != nil {
		return nil, 0, errors.New("tiff: failed to read IFD tag count: " + err.Error())
	}
	nTags := order.Uint16(b[0:2])
	tags := make([]byte, 12*nTags)

	offset += 2
	_, err = r.ReadAt(tags, int64(offset))
	if err != nil {
		return nil, 0, errors.New("tiff: falied to read offset to next IFD: " + err.Error())
	}
	// load tags
	for n := 0; n < int(nTags); n++ {
		t, err := DecodeTag(r, tags[n*12:(n+1)*12], order)
		if err != nil {
			return nil, 0, err
		}
		d.Tags = append(d.Tags, t)
		offset += 12
	}

	// get offset to next ifd

	_, err = r.ReadAt(b, int64(offset))
	if err != nil {
		return nil, 0, errors.New("tiff: falied to read offset to next IFD: " + err.Error())
	}

	return d, order.Uint32(b), nil
}

func (d *Dir) String() string {
	s := "Dir{"
	for _, t := range d.Tags {
		s += t.String() + ", "
	}
	return s + "}"
}
