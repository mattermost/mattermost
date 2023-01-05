// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"errors"
	"fmt"
	"image"
	"io"

	"image/jpeg"
	"image/png"
)

// EncoderOptions holds configuration options for an image encoder.
type EncoderOptions struct {
	// The level of concurrency for the encoder. This defines a limit on the
	// number of concurrently running encoding goroutines.
	ConcurrencyLevel int
}

func (o *EncoderOptions) validate() error {
	if o.ConcurrencyLevel < 0 {
		return errors.New("ConcurrencyLevel must be non-negative")
	}
	return nil
}

// Decoder holds the necessary state to encode images.
// This is safe to be used from multiple goroutines.
type Encoder struct {
	sem        chan struct{}
	opts       EncoderOptions
	pngEncoder *png.Encoder
}

// NewEncoder creates and returns a new image encoder with the given options.
func NewEncoder(opts EncoderOptions) (*Encoder, error) {
	var e Encoder
	if err := opts.validate(); err != nil {
		return nil, fmt.Errorf("imaging: error validating encoder options: %w", err)
	}
	if opts.ConcurrencyLevel > 0 {
		e.sem = make(chan struct{}, opts.ConcurrencyLevel)
	}
	e.opts = opts
	e.pngEncoder = &png.Encoder{
		CompressionLevel: png.BestCompression,
	}
	return &e, nil
}

// EncodeJPEG encodes the given image in JPEG format and writes the data to
// the passed writer.
func (e *Encoder) EncodeJPEG(wr io.Writer, img image.Image, quality int) error {
	if e.opts.ConcurrencyLevel > 0 {
		e.sem <- struct{}{}
		defer func() {
			<-e.sem
		}()
	}

	var encOpts jpeg.Options
	encOpts.Quality = quality
	if err := jpeg.Encode(wr, img, &encOpts); err != nil {
		return fmt.Errorf("imaging: failed to encode jpeg: %w", err)
	}

	return nil
}

// EncodePNG encodes the given image in PNG format and writes the data to
// the passed writer.
func (e *Encoder) EncodePNG(wr io.Writer, img image.Image) error {
	if e.opts.ConcurrencyLevel > 0 {
		e.sem <- struct{}{}
		defer func() {
			<-e.sem
		}()
	}

	if err := e.pngEncoder.Encode(wr, img); err != nil {
		return fmt.Errorf("imaging: failed to encode png: %w", err)
	}

	return nil
}
