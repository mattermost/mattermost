// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Copied from code.google.com/p/codesearch/regexp/copy.go.

// Copied from Go's regexp/syntax.
// Formatters edited to handle instByteRange.

package main

import (
	"bytes"
	"fmt"
	"regexp/syntax"
	"sort"
	"strconv"
	"unicode"
)

// cleanClass sorts the ranges (pairs of elements of r),
// merges them, and eliminates duplicates.
func cleanClass(rp *[]rune) []rune {

	// Sort by lo increasing, hi decreasing to break ties.
	sort.Sort(ranges{rp})

	r := *rp
	if len(r) < 2 {
		return r
	}

	// Merge abutting, overlapping.
	w := 2 // write index
	for i := 2; i < len(r); i += 2 {
		lo, hi := r[i], r[i+1]
		if lo <= r[w-1]+1 {
			// merge with previous range
			if hi > r[w-1] {
				r[w-1] = hi
			}
			continue
		}
		// new disjoint range
		r[w] = lo
		r[w+1] = hi
		w += 2
	}

	return r[:w]
}

// appendRange returns the result of appending the range lo-hi to the class r.
func appendRange(r []rune, lo, hi rune) []rune {
	// Expand last range or next to last range if it overlaps or abuts.
	// Checking two ranges helps when appending case-folded
	// alphabets, so that one range can be expanding A-Z and the
	// other expanding a-z.
	n := len(r)
	for i := 2; i <= 4; i += 2 { // twice, using i=2, i=4
		if n >= i {
			rlo, rhi := r[n-i], r[n-i+1]
			if lo <= rhi+1 && rlo <= hi+1 {
				if lo < rlo {
					r[n-i] = lo
				}
				if hi > rhi {
					r[n-i+1] = hi
				}
				return r
			}
		}
	}

	return append(r, lo, hi)
}

const (
	// minimum and maximum runes involved in folding.
	// checked during test.
	minFold = 0x0041
	maxFold = 0x1044f
)

// appendFoldedRange returns the result of appending the range lo-hi
// and its case folding-equivalent runes to the class r.
func appendFoldedRange(r []rune, lo, hi rune) []rune {
	// Optimizations.
	if lo <= minFold && hi >= maxFold {
		// Range is full: folding can't add more.
		return appendRange(r, lo, hi)
	}
	if hi < minFold || lo > maxFold {
		// Range is outside folding possibilities.
		return appendRange(r, lo, hi)
	}
	if lo < minFold {
		// [lo, minFold-1] needs no folding.
		r = appendRange(r, lo, minFold-1)
		lo = minFold
	}
	if hi > maxFold {
		// [maxFold+1, hi] needs no folding.
		r = appendRange(r, maxFold+1, hi)
		hi = maxFold
	}

	// Brute force.  Depend on appendRange to coalesce ranges on the fly.
	for c := lo; c <= hi; c++ {
		r = appendRange(r, c, c)
		f := unicode.SimpleFold(c)
		for f != c {
			r = appendRange(r, f, f)
			f = unicode.SimpleFold(f)
		}
	}
	return r
}

// ranges implements sort.Interface on a []rune.
// The choice of receiver type definition is strange
// but avoids an allocation since we already have
// a *[]rune.
type ranges struct {
	p *[]rune
}

func (ra ranges) Less(i, j int) bool {
	p := *ra.p
	i *= 2
	j *= 2
	return p[i] < p[j] || p[i] == p[j] && p[i+1] > p[j+1]
}

func (ra ranges) Len() int {
	return len(*ra.p) / 2
}

func (ra ranges) Swap(i, j int) {
	p := *ra.p
	i *= 2
	j *= 2
	p[i], p[i+1], p[j], p[j+1] = p[j], p[j+1], p[i], p[i+1]
}

func progString(p *syntax.Prog) string {
	var b bytes.Buffer
	dumpProg(&b, p)
	return b.String()
}

func instString(i *syntax.Inst) string {
	var b bytes.Buffer
	dumpInst(&b, i)
	return b.String()
}

func bw(b *bytes.Buffer, args ...string) {
	for _, s := range args {
		b.WriteString(s)
	}
}

func dumpProg(b *bytes.Buffer, p *syntax.Prog) {
	for j := range p.Inst {
		i := &p.Inst[j]
		pc := strconv.Itoa(j)
		if len(pc) < 3 {
			b.WriteString("   "[len(pc):])
		}
		if j == p.Start {
			pc += "*"
		}
		bw(b, pc, "\t")
		dumpInst(b, i)
		bw(b, "\n")
	}
}

func u32(i uint32) string {
	return strconv.FormatUint(uint64(i), 10)
}

func dumpInst(b *bytes.Buffer, i *syntax.Inst) {
	switch i.Op {
	case syntax.InstAlt:
		bw(b, "alt -> ", u32(i.Out), ", ", u32(i.Arg))
	case syntax.InstAltMatch:
		bw(b, "altmatch -> ", u32(i.Out), ", ", u32(i.Arg))
	case syntax.InstCapture:
		bw(b, "cap ", u32(i.Arg), " -> ", u32(i.Out))
	case syntax.InstEmptyWidth:
		bw(b, "empty ", u32(i.Arg), " -> ", u32(i.Out))
	case syntax.InstMatch:
		bw(b, "match")
	case syntax.InstFail:
		bw(b, "fail")
	case syntax.InstNop:
		bw(b, "nop -> ", u32(i.Out))
	case instByteRange:
		fmt.Fprintf(b, "byte %02x-%02x", (i.Arg>>8)&0xFF, i.Arg&0xFF)
		if i.Arg&argFold != 0 {
			bw(b, "/i")
		}
		bw(b, " -> ", u32(i.Out))

	// Should not happen
	case syntax.InstRune:
		if i.Rune == nil {
			// shouldn't happen
			bw(b, "rune <nil>")
		}
		bw(b, "rune ", strconv.QuoteToASCII(string(i.Rune)))
		if syntax.Flags(i.Arg)&syntax.FoldCase != 0 {
			bw(b, "/i")
		}
		bw(b, " -> ", u32(i.Out))
	case syntax.InstRune1:
		bw(b, "rune1 ", strconv.QuoteToASCII(string(i.Rune)), " -> ", u32(i.Out))
	case syntax.InstRuneAny:
		bw(b, "any -> ", u32(i.Out))
	case syntax.InstRuneAnyNotNL:
		bw(b, "anynotnl -> ", u32(i.Out))
	}
}
