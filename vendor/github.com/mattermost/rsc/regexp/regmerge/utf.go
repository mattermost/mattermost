// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Copy of code.google.com/p/codesearch/regexp/utf.go.

package main

import (
	"regexp/syntax"
	"unicode"
	"unicode/utf8"
)

const (
	instFail      = syntax.InstFail
	instAlt       = syntax.InstAlt
	instByteRange = syntax.InstRune | 0x80 // local opcode

	argFold = 1 << 16
)

func toByteProg(prog *syntax.Prog) error {
	var b runeBuilder
	for pc := range prog.Inst {
		i := &prog.Inst[pc]
		switch i.Op {
		case syntax.InstRune, syntax.InstRune1:
			// General rune range.  PIA.
			// TODO: Pick off single-byte case.
			if lo, hi, fold, ok := oneByteRange(i); ok {
				i.Op = instByteRange
				i.Arg = uint32(lo)<<8 | uint32(hi)
				if fold {
					i.Arg |= argFold
				}
				break
			}

			r := i.Rune
			if syntax.Flags(i.Arg)&syntax.FoldCase != 0 {
				// Build folded list.
				var rr []rune
				if len(r) == 1 {
					rr = appendFoldedRange(rr, r[0], r[0])
				} else {
					for j := 0; j < len(r); j += 2 {
						rr = appendFoldedRange(rr, r[j], r[j+1])
					}
				}
				r = rr
			}

			b.init(prog, uint32(pc), i.Out)
			if len(r) == 1 {
				b.addRange(r[0], r[0], false)
			} else {
				for j := 0; j < len(r); j += 2 {
					b.addRange(r[j], r[j+1], false)
				}
			}

		case syntax.InstRuneAny, syntax.InstRuneAnyNotNL:
			// All runes.
			// AnyNotNL should exclude \n but the line-at-a-time
			// execution takes care of that for us.
			b.init(prog, uint32(pc), i.Out)
			b.addRange(0, unicode.MaxRune, false)
		}
	}
	return nil
}

func oneByteRange(i *syntax.Inst) (lo, hi byte, fold, ok bool) {
	if i.Op == syntax.InstRune1 {
		r := i.Rune[0]
		if r < utf8.RuneSelf {
			return byte(r), byte(r), false, true
		}
	}
	if i.Op != syntax.InstRune {
		return
	}
	fold = syntax.Flags(i.Arg)&syntax.FoldCase != 0
	if len(i.Rune) == 1 || len(i.Rune) == 2 && i.Rune[0] == i.Rune[1] {
		r := i.Rune[0]
		if r >= utf8.RuneSelf {
			return
		}
		if fold && !asciiFold(r) {
			return
		}
		return byte(r), byte(r), fold, true
	}
	if len(i.Rune) == 2 && i.Rune[1] < utf8.RuneSelf {
		if fold {
			for r := i.Rune[0]; r <= i.Rune[1]; r++ {
				if asciiFold(r) {
					return
				}
			}
		}
		return byte(i.Rune[0]), byte(i.Rune[1]), fold, true
	}
	if len(i.Rune) == 4 && i.Rune[0] == i.Rune[1] && i.Rune[2] == i.Rune[3] && unicode.SimpleFold(i.Rune[0]) == i.Rune[2] && unicode.SimpleFold(i.Rune[2]) == i.Rune[0] {
		return byte(i.Rune[0]), byte(i.Rune[0]), true, true
	}

	return
}

func asciiFold(r rune) bool {
	if r >= utf8.RuneSelf {
		return false
	}
	r1 := unicode.SimpleFold(r)
	if r1 >= utf8.RuneSelf {
		return false
	}
	if r1 == r {
		return true
	}
	return unicode.SimpleFold(r1) == r
}

func maxRune(n int) rune {
	b := 0
	if n == 1 {
		b = 7
	} else {
		b = 8 - (n + 1) + 6*(n-1)
	}
	return 1<<uint(b) - 1
}

type cacheKey struct {
	lo, hi uint8
	fold   bool
	next   uint32
}

type runeBuilder struct {
	begin uint32
	out   uint32
	cache map[cacheKey]uint32
	p     *syntax.Prog
}

func (b *runeBuilder) init(p *syntax.Prog, begin, out uint32) {
	// We will rewrite p.Inst[begin] to hold the accumulated
	// machine.  For now, there is no match.
	p.Inst[begin].Op = instFail

	b.begin = begin
	b.out = out
	if b.cache == nil {
		b.cache = make(map[cacheKey]uint32)
	}
	for k := range b.cache {
		delete(b.cache, k)
	}
	b.p = p
}

func (b *runeBuilder) uncachedSuffix(lo, hi byte, fold bool, next uint32) uint32 {
	if next == 0 {
		next = b.out
	}
	pc := len(b.p.Inst)
	i := syntax.Inst{Op: instByteRange, Arg: uint32(lo)<<8 | uint32(hi), Out: next}
	if fold {
		i.Arg |= argFold
	}
	b.p.Inst = append(b.p.Inst, i)
	return uint32(pc)
}

func (b *runeBuilder) suffix(lo, hi byte, fold bool, next uint32) uint32 {
	if lo < 0x80 || hi > 0xbf {
		// Not a continuation byte, no need to cache.
		return b.uncachedSuffix(lo, hi, fold, next)
	}

	key := cacheKey{lo, hi, fold, next}
	if pc, ok := b.cache[key]; ok {
		return pc
	}

	pc := b.uncachedSuffix(lo, hi, fold, next)
	b.cache[key] = pc
	return pc
}

func (b *runeBuilder) addBranch(pc uint32) {
	// Add pc to the branch at the beginning.
	i := &b.p.Inst[b.begin]
	switch i.Op {
	case syntax.InstFail:
		i.Op = syntax.InstNop
		i.Out = pc
		return
	case syntax.InstNop:
		i.Op = syntax.InstAlt
		i.Arg = pc
		return
	case syntax.InstAlt:
		apc := uint32(len(b.p.Inst))
		b.p.Inst = append(b.p.Inst, syntax.Inst{Op: instAlt, Out: i.Arg, Arg: pc})
		i = &b.p.Inst[b.begin]
		i.Arg = apc
		b.begin = apc
	}
}

func (b *runeBuilder) addRange(lo, hi rune, fold bool) {
	if lo > hi {
		return
	}

	// TODO: Pick off 80-10FFFF for special handling?
	if lo == 0x80 && hi == 0x10FFFF {
	}

	// Split range into same-length sized ranges.
	for i := 1; i < utf8.UTFMax; i++ {
		max := maxRune(i)
		if lo <= max && max < hi {
			b.addRange(lo, max, fold)
			b.addRange(max+1, hi, fold)
			return
		}
	}

	// ASCII range is special.
	if hi < utf8.RuneSelf {
		b.addBranch(b.suffix(byte(lo), byte(hi), fold, 0))
		return
	}

	// Split range into sections that agree on leading bytes.
	for i := 1; i < utf8.UTFMax; i++ {
		m := rune(1)<<uint(6*i) - 1 // last i bytes of UTF-8 sequence
		if lo&^m != hi&^m {
			if lo&m != 0 {
				b.addRange(lo, lo|m, fold)
				b.addRange((lo|m)+1, hi, fold)
				return
			}
			if hi&m != m {
				b.addRange(lo, hi&^m-1, fold)
				b.addRange(hi&^m, hi, fold)
				return
			}
		}
	}

	// Finally.  Generate byte matching equivalent for lo-hi.
	var ulo, uhi [utf8.UTFMax]byte
	n := utf8.EncodeRune(ulo[:], lo)
	m := utf8.EncodeRune(uhi[:], hi)
	if n != m {
		panic("codesearch/regexp: bad utf-8 math")
	}

	pc := uint32(0)
	for i := n - 1; i >= 0; i-- {
		pc = b.suffix(ulo[i], uhi[i], false, pc)
	}
	b.addBranch(pc)
}
