// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"sync"

	_ "github.com/oov/psd"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"
)

// DecoderOptions holds configuration options for an image decoder.
type DecoderOptions struct {
	// The level of concurrency for the decoder. This defines a limit on the
	// number of concurrently running encoding goroutines.
	ConcurrencyLevel int
}

func (o *DecoderOptions) validate() error {
	if o.ConcurrencyLevel < 0 {
		return errors.New("ConcurrencyLevel must be non-negative")
	}
	return nil
}

// Decoder holds the necessary state to decode images.
// This is safe to be used from multiple goroutines.
type Decoder struct {
	sem  chan struct{}
	opts DecoderOptions
}

// NewDecoder creates and returns a new image decoder with the given options.
func NewDecoder(opts DecoderOptions) (*Decoder, error) {
	var d Decoder
	if err := opts.validate(); err != nil {
		return nil, fmt.Errorf("imaging: error validating decoder options: %w", err)
	}
	if opts.ConcurrencyLevel > 0 {
		d.sem = make(chan struct{}, opts.ConcurrencyLevel)
	}
	d.opts = opts
	return &d, nil
}

// Decode decodes the given encoded data and returns the decoded image.
func (d *Decoder) Decode(rd io.Reader) (img image.Image, format string, err error) {
	if d.opts.ConcurrencyLevel != 0 {
		d.sem <- struct{}{}
		defer func() { <-d.sem }()
	}

	img, format, err = image.Decode(rd)
	if err != nil {
		return nil, "", fmt.Errorf("imaging: failed to decode image: %w", err)
	}

	return img, format, nil
}

// DecodeMemBounded works similarly to Decode but also returns a release function that
// must be called when access to the raw image is not needed anymore.
// This sets the raw image data pointer to nil in an attempt to help the GC to re-use the underlying data as soon as possible.
func (d *Decoder) DecodeMemBounded(rd io.Reader) (img image.Image, format string, releaseFunc func(), err error) {
	if d.opts.ConcurrencyLevel != 0 {
		d.sem <- struct{}{}
		defer func() {
			if err != nil {
				<-d.sem
			}
		}()
	}

	img, format, err = image.Decode(rd)
	if err != nil {
		return nil, "", nil, fmt.Errorf("imaging: failed to decode image: %w", err)
	}

	var once sync.Once
	releaseFunc = func() {
		if d.opts.ConcurrencyLevel == 0 {
			return
		}
		once.Do(func() {
			if img != nil {
				releaseImageData(img)
			}
			<-d.sem
		})
	}

	return img, format, releaseFunc, nil
}

// DecodeConfig returns the image config for the given data.
func (d *Decoder) DecodeConfig(rd io.Reader) (image.Config, string, error) {
	img, format, err := image.DecodeConfig(rd)
	if err != nil {
		return image.Config{}, "", fmt.Errorf("imaging: failed to decode image config: %w", err)
	}
	return img, format, nil
}

// GetDimensions returns the dimensions for the given encoded image data.
func GetDimensions(imageData io.Reader) (width int, height int, err error) {
	cfg, _, err := image.DecodeConfig(imageData)
	width, height = cfg.Width, cfg.Height
	if seeker, ok := imageData.(io.Seeker); ok {
		_, err2 := seeker.Seek(0, 0)
		if err == nil && err2 != nil {
			err = fmt.Errorf("failed to seek back to the beginning of the image data: %w", err2)
		}
	}
	return
}

// This is only needed to try and simplify GC work.
func releaseImageData(img image.Image) {
	switch raw := img.(type) {
	case *image.Alpha:
		raw.Pix = nil
	case *image.Alpha16:
		raw.Pix = nil
	case *image.Gray:
		raw.Pix = nil
	case *image.Gray16:
		raw.Pix = nil
	case *image.NRGBA:
		raw.Pix = nil
	case *image.NRGBA64:
		raw.Pix = nil
	case *image.Paletted:
		raw.Pix = nil
	case *image.RGBA:
		raw.Pix = nil
	case *image.RGBA64:
		raw.Pix = nil
	default:
		return
	}
}
