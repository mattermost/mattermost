// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Code to merge (join) multiple regexp progs into a single prog.
// New code; not copied from anywhere.

package main

import "regexp/syntax"

func joinProgs(progs []*syntax.Prog) *syntax.Prog {
	all := &syntax.Prog{}
	for i, p := range progs {
		n := len(all.Inst)
		all.Inst = append(all.Inst, p.Inst...)
		match := shiftInst(all.Inst[n:], n)
		if match < 0 {
			// no match instruction; give up
			all.Inst = []syntax.Inst{{Op: syntax.InstFail}}
			all.Start = 0
			return all
		}
		match += n
		m := len(all.Inst)
		all.Inst = append(all.Inst,
			syntax.Inst{Op: syntax.InstAlt, Out: uint32(p.Start+n), Arg: uint32(m+1)},
			syntax.Inst{Op: instByteRange, Arg: 0x00FF, Out: uint32(m)},
			syntax.Inst{Op: instByteRange, Arg: 0x00FF, Out: uint32(match)},
			syntax.Inst{Op: syntax.InstMatch},
		)
		all.Inst[match] = syntax.Inst{Op: syntax.InstAlt, Out: uint32(m+2), Arg: uint32(m+3)}

		if i == 0 {
			all.Start = m
		} else {
			old := all.Start
			all.Start = len(all.Inst)
			all.Inst = append(all.Inst, syntax.Inst{Op: syntax.InstAlt, Out: uint32(old), Arg: uint32(m)})
		}
	}

	return all
}

func shiftInst(inst []syntax.Inst, n int) int {
	match := -1
	for i := range inst {
		ip := &inst[i]
		ip.Out += uint32(n)
		if ip.Op == syntax.InstMatch {
			if match >= 0 {
				panic("double match")
			}
			match = i
		}
		if ip.Op == syntax.InstAlt || ip.Op == syntax.InstAltMatch {
			ip.Arg += uint32(n)
		}
	}
	return match
}

func (m *matcher) crunchProg() {
	var rewrite [256]byte

	for i := range m.prog.Inst {
		ip := &m.prog.Inst[i]
		switch ip.Op {
		case instByteRange:
			lo, hi := byte(ip.Arg>>8), byte(ip.Arg)
			rewrite[lo] = 1
			if hi < 255 {
				rewrite[hi+1] = 1
			}
		case syntax.InstEmptyWidth:
			switch op := syntax.EmptyOp(ip.Arg); {
			case op&(syntax.EmptyBeginLine|syntax.EmptyEndLine) != 0:
				rewrite['\n'] = 1
				rewrite['\n'+1] = 1
			case op&(syntax.EmptyWordBoundary|syntax.EmptyNoWordBoundary) != 0:
				rewrite['A'] = 1
				rewrite['Z'+1] = 1
				rewrite['a'] = 1
				rewrite['z'+1] = 1
				rewrite['0'] = 1
				rewrite['9'+1] = 1
				rewrite['_'] = 1
				rewrite['_'+1] = 1
			}
		}
	}

	rewrite[0] = 0
	for i := 1; i < 256; i++ {
		rewrite[i] += rewrite[i-1]
	}
	m.numByte = int(rewrite[255]) + 1

	for i := 255; i >= 0; i-- {
		m.undo[rewrite[i]] = byte(i)
	}
}
