/*
 * Copyright 2020 Dgraph Labs, Inc. and Contributors
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

package z

import (
	"fmt"
	"math"
	"strings"

	"github.com/dustin/go-humanize"
)

// Creates bounds for an histogram. The bounds are powers of two of the form
// [2^min_exponent, ..., 2^max_exponent].
func HistogramBounds(minExponent, maxExponent uint32) []float64 {
	var bounds []float64
	for i := minExponent; i <= maxExponent; i++ {
		bounds = append(bounds, float64(int(1)<<i))
	}
	return bounds
}

// HistogramData stores the information needed to represent the sizes of the keys and values
// as a histogram.
type HistogramData struct {
	Bounds         []float64
	Count          int64
	CountPerBucket []int64
	Min            int64
	Max            int64
	Sum            int64
}

// NewHistogramData returns a new instance of HistogramData with properly initialized fields.
func NewHistogramData(bounds []float64) *HistogramData {
	return &HistogramData{
		Bounds:         bounds,
		CountPerBucket: make([]int64, len(bounds)+1),
		Max:            0,
		Min:            math.MaxInt64,
	}
}

func (histogram *HistogramData) Copy() *HistogramData {
	if histogram == nil {
		return nil
	}
	return &HistogramData{
		Bounds:         append([]float64{}, histogram.Bounds...),
		CountPerBucket: append([]int64{}, histogram.CountPerBucket...),
		Count:          histogram.Count,
		Min:            histogram.Min,
		Max:            histogram.Max,
		Sum:            histogram.Sum,
	}
}

// Update changes the Min and Max fields if value is less than or greater than the current values.
func (histogram *HistogramData) Update(value int64) {
	if histogram == nil {
		return
	}
	if value > histogram.Max {
		histogram.Max = value
	}
	if value < histogram.Min {
		histogram.Min = value
	}

	histogram.Sum += value
	histogram.Count++

	for index := 0; index <= len(histogram.Bounds); index++ {
		// Allocate value in the last buckets if we reached the end of the Bounds array.
		if index == len(histogram.Bounds) {
			histogram.CountPerBucket[index]++
			break
		}

		if value < int64(histogram.Bounds[index]) {
			histogram.CountPerBucket[index]++
			break
		}
	}
}

// Mean returns the mean value for the histogram.
func (histogram *HistogramData) Mean() float64 {
	if histogram.Count == 0 {
		return 0
	}
	return float64(histogram.Sum) / float64(histogram.Count)
}

// String converts the histogram data into human-readable string.
func (histogram *HistogramData) String() string {
	if histogram == nil {
		return ""
	}
	var b strings.Builder

	b.WriteString("\n -- Histogram: \n")
	b.WriteString(fmt.Sprintf("Min value: %d \n", histogram.Min))
	b.WriteString(fmt.Sprintf("Max value: %d \n", histogram.Max))
	b.WriteString(fmt.Sprintf("Mean: %.2f \n", histogram.Mean()))
	b.WriteString(fmt.Sprintf("Count: %d \n", histogram.Count))

	numBounds := len(histogram.Bounds)
	for index, count := range histogram.CountPerBucket {
		if count == 0 {
			continue
		}

		// The last bucket represents the bucket that contains the range from
		// the last bound up to infinity so it's processed differently than the
		// other buckets.
		if index == len(histogram.CountPerBucket)-1 {
			lowerBound := uint64(histogram.Bounds[numBounds-1])
			page := float64(count*100) / float64(histogram.Count)
			b.WriteString(fmt.Sprintf("[%s, %s) %d %.2f%% \n",
				humanize.IBytes(lowerBound), "infinity", count, page))
			continue
		}

		upperBound := uint64(histogram.Bounds[index])
		lowerBound := uint64(0)
		if index > 0 {
			lowerBound = uint64(histogram.Bounds[index-1])
		}

		page := float64(count*100) / float64(histogram.Count)
		b.WriteString(fmt.Sprintf("[%s, %s) %d %.2f%% \n",
			humanize.IBytes(lowerBound), humanize.IBytes(upperBound), count, page))
	}
	b.WriteString(" --\n")
	return b.String()
}
