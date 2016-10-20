// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Copied from code.google.com/p/codesearch/regexp/copy.go
// and adapted for the problem of finding a matching string, not
// testing whether a particular string matches.

package main

import (
	"encoding/binary"
	"errors"
	"fmt"
	"hash/fnv"
	"hash"
	"log"
	"regexp/syntax"
)

// A matcher holds the state for running regular expression search.
type matcher struct {
	buf []byte
	prog      *syntax.Prog       // compiled program
	dstate    map[uint32]*dstate // dstate cache
	start     *dstate            // start state
	startLine *dstate            // start state for beginning of line
	z1, z2, z3    nstate             // three temporary nstates
	ids []int
	numState int
	maxState int
	numByte int
	numMatch int
	undo [256]byte
	all *dstate
	allTail **dstate
	h hash.Hash32
}

// An nstate corresponds to an NFA state.
type nstate struct {
	q       Set // queue of program instructions
	flag    flags      // flags (TODO)
	needFlag syntax.EmptyOp
}

// The flags record state about a position between bytes in the text.
type flags uint32

const (
	flagBOL  flags = 1 << iota // beginning of line
	flagEOL                    // end of line
	flagBOT                    // beginning of text
	flagEOT                    // end of text
	flagWord                   // last byte was word byte
)

// A dstate corresponds to a DFA state.
type dstate struct {
	enc      string       // encoded nstate
	nextAll *dstate
	nextHash *dstate
	prev *dstate
	prevByte int
	done bool
}

func (z *nstate) String() string {
	return fmt.Sprintf("%v/%#x+%#x", z.q.Dense(), z.flag, z.needFlag)
}

// enc encodes z as a string.
func (m *matcher) enc(z *nstate) []byte {
	buf := m.buf[:0]
	buf = append(buf, byte(z.needFlag), byte(z.flag))
	ids := m.ids[:0]
	for _, id := range z.q.Dense() {
		ids = append(ids, int(id))
	}
	sortInts(ids)
	last := ^uint32(0)
	for _, id := range ids {
		x := uint32(id)-last
		last = uint32(id)
		for x >= 0x80 {
			buf = append(buf, byte(x)|0x80)
			x >>= 7
		}
		buf = append(buf, byte(x))
	}
	m.buf = buf
	return buf
}

// dec decodes the encoding s into z.
func (m *matcher) dec(z *nstate, s string) {
	b := append(m.buf[:0], s...)
	m.buf = b
	z.needFlag = syntax.EmptyOp(b[0])
	b = b[1:]
	i, n := binary.Uvarint(b)
	if n <= 0 {
		bug()
	}
	b = b[n:]
	z.flag = flags(i)
	z.q.Reset()
	last := ^uint32(0)
	for len(b) > 0 {
		i, n = binary.Uvarint(b)
		if n <= 0 {
			bug()
		}
		b = b[n:]
		last += uint32(i)
		z.q.Add(last, 0, 0)
	}
}

// init initializes the matcher.
func (m *matcher) init(prog *syntax.Prog, n int) error {
	m.prog = prog
	m.dstate = make(map[uint32]*dstate)
	m.numMatch = n
	m.maxState = 10
	m.allTail = &m.all
	m.numByte = 256
	for i := range m.undo {
		m.undo[i] = byte(i)
	}
	m.h = fnv.New32()

	m.z1.q.Init(uint32(len(prog.Inst)))
	m.z2.q.Init(uint32(len(prog.Inst)))
	m.z3.q.Init(uint32(len(prog.Inst)))
	m.ids = make([]int, 0, len(prog.Inst))

	m.addq(&m.z1.q, uint32(prog.Start), syntax.EmptyBeginLine|syntax.EmptyBeginText)
	m.z1.flag = flagBOL | flagBOT
	m.start = m.cache(&m.z1, nil, 0)

	m.z1.q.Reset()
	m.addq(&m.z1.q, uint32(prog.Start), syntax.EmptyBeginLine)
	m.z1.flag = flagBOL
	m.startLine = m.cache(&m.z1, nil, 0)

	m.crunchProg()

	return nil
}

// stepEmpty steps runq to nextq expanding according to flag.
func (m *matcher) stepEmpty(runq, nextq *Set, flag syntax.EmptyOp) {
	nextq.Reset()
	for _, id := range runq.Dense() {
		m.addq(nextq, id, flag)
	}
}

// stepByte steps runq to nextq consuming c and then expanding according to flag.
// It returns true if a match ends immediately before c.
// c is either an input byte or endText.
func (m *matcher) stepByte(runq, nextq *Set, c int, flag syntax.EmptyOp) (match bool) {
	nextq.Reset()
	m.addq(nextq, uint32(m.prog.Start), flag)
	
	nmatch := 0
	for _, id := range runq.Dense() {
		i := &m.prog.Inst[id]
		switch i.Op {
		default:
			continue
		case syntax.InstMatch:
			nmatch++
			continue
		case instByteRange:
			if c == endText {
				break
			}
			lo := int((i.Arg >> 8) & 0xFF)
			hi := int(i.Arg & 0xFF)
			if i.Arg&argFold != 0 && 'a' <= c && c <= 'z' {
				c += 'A' - 'a'
			}
			if lo <= c && c <= hi {
				m.addq(nextq, i.Out, flag)
			}
		}
	}
	return nmatch == m.numMatch
}

// addq adds id to the queue, expanding according to flag.
func (m *matcher) addq(q *Set, id uint32, flag syntax.EmptyOp) {
	if q.Has(id, 0) {
		return
	}
	q.MustAdd(id)
	i := &m.prog.Inst[id]
	switch i.Op {
	case syntax.InstCapture, syntax.InstNop:
		m.addq(q, i.Out, flag)
	case syntax.InstAlt, syntax.InstAltMatch:
		m.addq(q, i.Out, flag)
		m.addq(q, i.Arg, flag)
	case syntax.InstEmptyWidth:
		if syntax.EmptyOp(i.Arg)&^flag == 0 {
			m.addq(q, i.Out, flag)
		}
	}
}

const endText = -1

// computeNext computes the next DFA state if we're in d reading c (an input byte or endText).
func (m *matcher) computeNext(this, next *nstate, d *dstate, c int) bool {
	// compute flags in effect before c
	flag := syntax.EmptyOp(0)
	if this.flag&flagBOL != 0 {
		flag |= syntax.EmptyBeginLine
	}
	if this.flag&flagBOT != 0 {
		flag |= syntax.EmptyBeginText
	}
	if this.flag&flagWord != 0 {
		if !isWordByte(c) {
			flag |= syntax.EmptyWordBoundary
		} else {
			flag |= syntax.EmptyNoWordBoundary
		}
	} else {
		if isWordByte(c) {
			flag |= syntax.EmptyWordBoundary
		} else {
			flag |= syntax.EmptyNoWordBoundary
		}
	}
	if c == '\n' {
		flag |= syntax.EmptyEndLine
	}
	if c == endText {
		flag |= syntax.EmptyEndLine | syntax.EmptyEndText
	}
	
	if flag &= this.needFlag; flag != 0 {
		// re-expand queue using new flags.
		// TODO: only do this when it matters
		// (something is gating on word boundaries).
		m.stepEmpty(&this.q, &next.q, flag)
		this, next = next, &m.z3
	}

	// now compute flags after c.
	flag = 0
	next.flag = 0
	if c == '\n' {
		flag |= syntax.EmptyBeginLine
		next.flag |= flagBOL
	}
	if isWordByte(c) {
		next.flag |= flagWord
	}

	// re-add start, process rune + expand according to flags.
	if m.stepByte(&this.q, &next.q, c, flag) {
		return true
	}
	next.needFlag = m.queueFlag(&next.q)
	if next.needFlag&syntax.EmptyBeginLine == 0 {
		next.flag &^= flagBOL
	}
	if next.needFlag&(syntax.EmptyWordBoundary|syntax.EmptyNoWordBoundary) == 0{
		next.flag &^= flagWord
	}

	m.cache(next, d, c)
	return false
}

func (m *matcher) queueFlag(runq *Set) syntax.EmptyOp {
	var e uint32
	for _, id := range runq.Dense() {
		i := &m.prog.Inst[id]
		if i.Op == syntax.InstEmptyWidth {
			e |= i.Arg
		}
	}
	return syntax.EmptyOp(e)
}

func (m *matcher) hash(enc []byte) uint32 {
	m.h.Reset()
	m.h.Write(enc)
	return m.h.Sum32()
}

func (m *matcher) find(h uint32, enc []byte) *dstate {
Search:
	for d := m.dstate[h]; d!=nil; d=d.nextHash { 
		s := d.enc
		if len(s) != len(enc) {
			continue Search
		}
		for i, b := range enc {
			if s[i] != b {
				continue Search
			}
		}
		return d
	}
	return nil
}

func (m *matcher) cache(z *nstate, prev *dstate, prevByte int) *dstate {
	enc := m.enc(z)
	h := m.hash(enc)
	d := m.find(h, enc)
	if d != nil {
		return d
	}

	if m.numState >= m.maxState {
		panic(ErrMemory)
	}
	m.numState++
	d = &dstate{
		enc: string(enc),
		prev: prev,
		prevByte: prevByte,
		nextHash: m.dstate[h],
	}
	m.dstate[h] = d
	*m.allTail = d
	m.allTail = &d.nextAll

	return d
}

// isWordByte reports whether the byte c is a word character: ASCII only.
// This is used to implement \b and \B.  This is not right for Unicode, but:
//	- it's hard to get right in a byte-at-a-time matching world
//	  (the DFA has only one-byte lookahead)
//	- this crude approximation is the same one PCRE uses
func isWordByte(c int) bool {
	return 'A' <= c && c <= 'Z' ||
		'a' <= c && c <= 'z' ||
		'0' <= c && c <= '9' ||
		c == '_'
}

var ErrNoMatch = errors.New("no matching strings")
var ErrMemory = errors.New("exhausted memory")

func (m *matcher) findMatch(maxState int) (s string, err error) {
	defer func() {
		switch r := recover().(type) {
		case nil:
			return
		case error:
			err = r
			return
		default:
			panic(r)
		}
	}()
		
	m.maxState = maxState
	numState := 0
	var d *dstate
	var c int
	for d = m.all; d != nil; d = d.nextAll {
		numState++
		if d.done {
			continue
		}
		this, next := &m.z1, &m.z2
		m.dec(this, d.enc)
		if m.computeNext(this, next, d, endText) {
			c = endText
			goto Found
		}
		for _, cb := range m.undo[:m.numByte] {
			if m.computeNext(this, next, d, int(cb)) {
				c = int(cb)
				goto Found
			}
		}
		d.done = true
	}
	log.Printf("searched %d states; queued %d states", numState, m.numState)
	return "", ErrNoMatch

Found:
	var buf []byte
	if c >= 0 {
		buf = append(buf, byte(c))
	}
	for d1 := d; d1.prev != nil; d1= d1.prev {
		buf = append(buf, byte(d1.prevByte))
	}
	for i, j := 0, len(buf)-1; i < j; i, j = i+1, j-1 {
		buf[i], buf[j] = buf[j], buf[i]
	}
	log.Printf("searched %d states; queued %d states", numState, m.numState)
	return string(buf), nil
}
