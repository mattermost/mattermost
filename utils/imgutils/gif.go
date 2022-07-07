// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This is a modified version, the original copyright was: Copyright (c) 2011
// The Go Authors.

package imgutils

// This contains a portion of Go's image/go library, modified to count the number of frames in a gif without loading
// the entire image into memory.

import (
	"bufio"
	"compress/lzw"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
)

var (
	errNotEnough = errors.New("gif: not enough image data")
	errTooMuch   = errors.New("gif: too much image data")
)

// If the io.Reader does not also have ReadByte, then decode will introduce its own buffering.
type reader interface {
	io.Reader
	io.ByteReader
}

// Masks etc.
const (
	// Fields.
	fColorTable         = 1 << 7
	fColorTableBitsMask = 7

	// Graphic control flags.
	gcTransparentColorSet = 1 << 0
	gcDisposalMethodMask  = 7 << 2
)

// Disposal Methods.
const (
	DisposalNone       = 0x01
	DisposalBackground = 0x02
	DisposalPrevious   = 0x03
)

// Section indicators.
const (
	sExtension       = 0x21
	sImageDescriptor = 0x2C
	sTrailer         = 0x3B
)

// Extensions.
const (
	eText           = 0x01 // Plain Text
	eGraphicControl = 0xF9 // Graphic Control
	eComment        = 0xFE // Comment
	eApplication    = 0xFF // Application
)

func readFull(r io.Reader, b []byte) error {
	_, err := io.ReadFull(r, b)
	if err == io.EOF {
		err = io.ErrUnexpectedEOF
	}
	return err
}

func readByte(r io.ByteReader) (byte, error) {
	b, err := r.ReadByte()
	if err == io.EOF {
		err = io.ErrUnexpectedEOF
	}
	return b, err
}

// decoder is the type used to decode a GIF file.
type decoder struct {
	r reader

	// From header.
	vers            string
	width           int
	height          int
	loopCount       int
	delayTime       int
	backgroundIndex byte
	disposalMethod  byte

	// From image descriptor.
	imageFields byte

	// From graphics control.
	transparentIndex    byte
	hasTransparentIndex bool

	// Computed.
	hasGlobalColorTable bool

	// Used when decoding.
	imageCount int
	tmp        [1024]byte // must be at least 768 so we can read color table
}

// blockReader parses the block structure of GIF image data, which comprises
// (n, (n bytes)) blocks, with 1 <= n <= 255. It is the reader given to the
// LZW decoder, which is thus immune to the blocking. After the LZW decoder
// completes, there will be a 0-byte block remaining (0, ()), which is
// consumed when checking that the blockReader is exhausted.
//
// To avoid the allocation of a bufio.Reader for the lzw Reader, blockReader
// implements io.ReadByte and buffers blocks into the decoder's "tmp" buffer.
type blockReader struct {
	d    *decoder
	i, j uint8 // d.tmp[i:j] contains the buffered bytes
	err  error
}

func (b *blockReader) fill() {
	if b.err != nil {
		return
	}
	b.j, b.err = readByte(b.d.r)
	if b.j == 0 && b.err == nil {
		b.err = io.EOF
	}
	if b.err != nil {
		return
	}

	b.i = 0
	b.err = readFull(b.d.r, b.d.tmp[:b.j])
	if b.err != nil {
		b.j = 0
	}
}

func (b *blockReader) ReadByte() (byte, error) {
	if b.i == b.j {
		b.fill()
		if b.err != nil {
			return 0, b.err
		}
	}

	c := b.d.tmp[b.i]
	b.i++
	return c, nil
}

// blockReader must implement io.Reader, but its Read shouldn't ever actually
// be called in practice. The compress/lzw package will only call ReadByte.
func (b *blockReader) Read(p []byte) (int, error) {
	if len(p) == 0 || b.err != nil {
		return 0, b.err
	}
	if b.i == b.j {
		b.fill()
		if b.err != nil {
			return 0, b.err
		}
	}

	n := copy(p, b.d.tmp[b.i:b.j])
	b.i += uint8(n)
	return n, nil
}

// close primarily detects whether or not a block terminator was encountered
// after reading a sequence of data sub-blocks. It allows at most one trailing
// sub-block worth of data. I.e., if some number of bytes exist in one sub-block
// following the end of LZW data, the very next sub-block must be the block
// terminator. If the very end of LZW data happened to fill one sub-block, at
// most one more sub-block of length 1 may exist before the block-terminator.
// These accommodations allow us to support GIFs created by less strict encoders.
// See https://golang.org/issue/16146.
func (b *blockReader) close() error {
	if b.err == io.EOF {
		// A clean block-sequence terminator was encountered while reading.
		return nil
	} else if b.err != nil {
		// Some other error was encountered while reading.
		return b.err
	}

	if b.i == b.j {
		// We reached the end of a sub block reading LZW data. We'll allow at
		// most one more sub block of data with a length of 1 byte.
		b.fill()
		if b.err == io.EOF {
			return nil
		} else if b.err != nil {
			return b.err
		} else if b.j > 1 {
			return errTooMuch
		}
	}

	// Part of a sub-block remains buffered. We expect that the next attempt to
	// buffer a sub-block will reach the block terminator.
	b.fill()
	if b.err == io.EOF {
		return nil
	} else if b.err != nil {
		return b.err
	}

	return errTooMuch
}

// decode reads a GIF image from r and stores the result in d.
func (d *decoder) decode(r io.Reader, configOnly bool) error {
	// Add buffering if r does not provide ReadByte.
	if rr, ok := r.(reader); ok {
		d.r = rr
	} else {
		d.r = bufio.NewReader(r)
	}

	d.loopCount = -1

	err := d.readHeaderAndScreenDescriptor()
	if err != nil {
		return err
	}
	if configOnly {
		return nil
	}

	for {
		c, err := readByte(d.r)
		if err != nil {
			return fmt.Errorf("gif: reading frames: %v", err)
		}
		switch c {
		case sExtension:
			if err = d.readExtension(); err != nil {
				return err
			}

		case sImageDescriptor:
			if err = d.readImageDescriptor(); err != nil {
				return err
			}

		case sTrailer:
			if d.imageCount == 0 {
				return fmt.Errorf("gif: missing image data")
			}
			return nil

		default:
			return fmt.Errorf("gif: unknown block type: 0x%.2x", c)
		}
	}
}

func (d *decoder) readHeaderAndScreenDescriptor() error {
	err := readFull(d.r, d.tmp[:13])
	if err != nil {
		return fmt.Errorf("gif: reading header: %v", err)
	}
	d.vers = string(d.tmp[:6])
	if d.vers != "GIF87a" && d.vers != "GIF89a" {
		return fmt.Errorf("gif: can't recognize format %q", d.vers)
	}
	d.width = int(d.tmp[6]) + int(d.tmp[7])<<8
	d.height = int(d.tmp[8]) + int(d.tmp[9])<<8
	if fields := d.tmp[10]; fields&fColorTable != 0 {
		d.backgroundIndex = d.tmp[11]
		// readColorTable overwrites the contents of d.tmp, but that's OK.
		if err = d.readColorTable(fields); err != nil {
			return err
		}
		d.hasGlobalColorTable = true
	}
	// d.tmp[12] is the Pixel Aspect Ratio, which is ignored.
	return nil
}

func (d *decoder) readColorTable(fields byte) error {
	n := 1 << (1 + uint(fields&fColorTableBitsMask))
	err := readFull(d.r, d.tmp[:3*n])
	if err != nil {
		return fmt.Errorf("gif: reading color table: %s", err)
	}
	return nil
}

func (d *decoder) readExtension() error {
	extension, err := readByte(d.r)
	if err != nil {
		return fmt.Errorf("gif: reading extension: %v", err)
	}
	size := 0
	switch extension {
	case eText:
		size = 13
	case eGraphicControl:
		return d.readGraphicControl()
	case eComment:
		// nothing to do but read the data.
	case eApplication:
		b, err := readByte(d.r)
		if err != nil {
			return fmt.Errorf("gif: reading extension: %v", err)
		}
		// The spec requires size be 11, but Adobe sometimes uses 10.
		size = int(b)
	default:
		return fmt.Errorf("gif: unknown extension 0x%.2x", extension)
	}
	if size > 0 {
		if err := readFull(d.r, d.tmp[:size]); err != nil {
			return fmt.Errorf("gif: reading extension: %v", err)
		}
	}

	// Application Extension with "NETSCAPE2.0" as string and 1 in data means
	// this extension defines a loop count.
	if extension == eApplication && string(d.tmp[:size]) == "NETSCAPE2.0" {
		n, err := d.readBlock()
		if err != nil {
			return fmt.Errorf("gif: reading extension: %v", err)
		}
		if n == 0 {
			return nil
		}
		if n == 3 && d.tmp[0] == 1 {
			d.loopCount = int(d.tmp[1]) | int(d.tmp[2])<<8
		}
	}
	for {
		n, err := d.readBlock()
		if err != nil {
			return fmt.Errorf("gif: reading extension: %v", err)
		}
		if n == 0 {
			return nil
		}
	}
}

func (d *decoder) readGraphicControl() error {
	if err := readFull(d.r, d.tmp[:6]); err != nil {
		return fmt.Errorf("gif: can't read graphic control: %s", err)
	}
	if d.tmp[0] != 4 {
		return fmt.Errorf("gif: invalid graphic control extension block size: %d", d.tmp[0])
	}
	flags := d.tmp[1]
	d.disposalMethod = (flags & gcDisposalMethodMask) >> 2
	d.delayTime = int(d.tmp[2]) | int(d.tmp[3])<<8
	if flags&gcTransparentColorSet != 0 {
		d.transparentIndex = d.tmp[4]
		d.hasTransparentIndex = true
	}
	if d.tmp[5] != 0 {
		return fmt.Errorf("gif: invalid graphic control extension block terminator: %d", d.tmp[5])
	}
	return nil
}

func (d *decoder) readImageDescriptor() error {
	err := d.checkImageFromDescriptor()
	if err != nil {
		return err
	}
	useLocalColorTable := d.imageFields&fColorTable != 0
	if useLocalColorTable {
		if err = d.readColorTable(d.imageFields); err != nil {
			return err
		}
	} else if !d.hasGlobalColorTable {
		return errors.New("gif: no color table")
	}
	litWidth, err := readByte(d.r)
	if err != nil {
		return fmt.Errorf("gif: reading image data: %v", err)
	}
	if litWidth < 2 || litWidth > 8 {
		return fmt.Errorf("gif: pixel size in decode out of range: %d", litWidth)
	}
	// A wonderfully Go-like piece of magic.
	br := &blockReader{d: d}
	lzwr := lzw.NewReader(br, lzw.LSB, int(litWidth))
	defer lzwr.Close()

	if _, err := io.Copy(io.Discard, lzwr); err != nil {
		if err != io.ErrUnexpectedEOF {
			return fmt.Errorf("gif: reading image data: %v", err)
		}
		return errNotEnough
	}

	// In theory, both lzwr and br should be exhausted. Reading from them
	// should yield (0, io.EOF).
	//
	// The spec (Appendix F - Compression), says that "An End of
	// Information code... must be the last code output by the encoder
	// for an image". In practice, though, giflib (a widely used C
	// library) does not enforce this, so we also accept lzwr returning
	// io.ErrUnexpectedEOF (meaning that the encoded stream hit io.EOF
	// before the LZW decoder saw an explicit end code), provided that
	// the io.ReadFull call above successfully read len(m.Pix) bytes.
	// See https://golang.org/issue/9856 for an example GIF.
	if n, err := lzwr.Read(d.tmp[256:257]); n != 0 || (err != io.EOF && err != io.ErrUnexpectedEOF) {
		if err != nil {
			return fmt.Errorf("gif: reading image data: %v", err)
		}
		return errTooMuch
	}

	// In practice, some GIFs have an extra byte in the data sub-block
	// stream, which we ignore. See https://golang.org/issue/16146.
	if err := br.close(); err == errTooMuch {
		return errTooMuch
	} else if err != nil {
		return fmt.Errorf("gif: reading image data: %v", err)
	}

	d.imageCount += 1

	return nil
}

func (d *decoder) checkImageFromDescriptor() error {
	if err := readFull(d.r, d.tmp[:9]); err != nil {
		return fmt.Errorf("gif: can't read image descriptor: %s", err)
	}
	left := int(d.tmp[0]) + int(d.tmp[1])<<8
	top := int(d.tmp[2]) + int(d.tmp[3])<<8
	width := int(d.tmp[4]) + int(d.tmp[5])<<8
	height := int(d.tmp[6]) + int(d.tmp[7])<<8
	d.imageFields = d.tmp[8]

	// The GIF89a spec, Section 20 (Image Descriptor) says: "Each image must
	// fit within the boundaries of the Logical Screen, as defined in the
	// Logical Screen Descriptor."
	//
	// This is conceptually similar to testing
	//	frameBounds := image.Rect(left, top, left+width, top+height)
	//	imageBounds := image.Rect(0, 0, d.width, d.height)
	//	if !frameBounds.In(imageBounds) { etc }
	// but the semantics of the Go image.Rectangle type is that r.In(s) is true
	// whenever r is an empty rectangle, even if r.Min.X > s.Max.X. Here, we
	// want something stricter.
	//
	// Note that, by construction, left >= 0 && top >= 0, so we only have to
	// explicitly compare frameBounds.Max (left+width, top+height) against
	// imageBounds.Max (d.width, d.height) and not frameBounds.Min (left, top)
	// against imageBounds.Min (0, 0).
	if left+width > d.width || top+height > d.height {
		return errors.New("gif: frame bounds larger than image bounds")
	}

	return nil
}

func (d *decoder) readBlock() (int, error) {
	n, err := readByte(d.r)
	if n == 0 || err != nil {
		return 0, err
	}
	if err := readFull(d.r, d.tmp[:n]); err != nil {
		return 0, err
	}
	return int(n), nil
}

func CountGIFFrames(r io.Reader) (int, error) {
	var d decoder
	if err := d.decode(r, false); err != nil {
		return -1, err
	}
	return d.imageCount, nil
}

func GenGIFData(width, height uint16, nFrames int) []byte {
	header := []byte{
		'G', 'I', 'F', '8', '9', 'a', // header
		0, 0, 0, 0, // width and height
		128, 0, 0, // other header information
		0, 0, 0, 1, 1, 1, // color table
	}
	binary.LittleEndian.PutUint16(header[6:], width)
	binary.LittleEndian.PutUint16(header[8:], height)
	frame := []byte{
		0x2c,                   // block introducer
		0, 0, 0, 0, 1, 0, 1, 0, // position and dimensions of the frame
		0,                      // other frame information
		0x2, 0x2, 0x4c, 0x1, 0, // encoded pixel data
	}
	trailer := []byte{0x3b}
	gifData := header
	for i := 0; i < nFrames; i++ {
		gifData = append(gifData, frame...)
	}
	gifData = append(gifData, trailer...)
	return gifData
}
