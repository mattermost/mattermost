package rardecode

import (
	"errors"
	"io"
)

const (
	rangeBottom = 1 << 15
	rangeTop    = 1 << 24

	maxFreq = 124

	intBits    = 7
	periodBits = 7
	binScale   = 1 << (intBits + periodBits)

	n0       = 1
	n1       = 4
	n2       = 4
	n3       = 4
	n4       = (128 + 3 - 1*n1 - 2*n2 - 3*n3) / 4
	nIndexes = n0 + n1 + n2 + n3 + n4

	// memory is allocated in units. A unit contains unitSize number of bytes.
	// A unit can store one context or two states.
	unitSize = 12

	maxUint16 = 1<<16 - 1
	freeMark  = -1
)

var (
	errCorruptPPM = errors.New("rardecode: corrupt ppm data")

	expEscape  = []byte{25, 14, 9, 7, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2}
	initBinEsc = []uint16{0x3CDD, 0x1F3F, 0x59BF, 0x48F3, 0x64A1, 0x5ABC, 0x6632, 0x6051}

	ns2Index   [256]byte
	ns2BSIndex [256]byte

	// units2Index maps the number of units in a block to a freelist index
	units2Index [128 + 1]byte
	// index2Units maps a freelist index to the size of the block in units
	index2Units [nIndexes]int32
)

func init() {
	ns2BSIndex[0] = 2 * 0
	ns2BSIndex[1] = 2 * 1
	for i := 2; i < 11; i++ {
		ns2BSIndex[i] = 2 * 2
	}
	for i := 11; i < 256; i++ {
		ns2BSIndex[i] = 2 * 3
	}

	var j, n byte
	for i := range ns2Index {
		ns2Index[i] = n
		if j <= 3 {
			n++
			j = n
		} else {
			j--
		}
	}

	var ii byte
	var iu, units int32
	for i, n := range []int{n0, n1, n2, n3, n4} {
		for j := 0; j < n; j++ {
			units += int32(i)
			index2Units[ii] = units
			for iu <= units {
				units2Index[iu] = ii
				iu++
			}
			ii++
		}
	}
}

type rangeCoder struct {
	br   io.ByteReader
	code uint32
	low  uint32
	rnge uint32
}

func (r *rangeCoder) init(br io.ByteReader) error {
	r.br = br
	r.low = 0
	r.rnge = ^uint32(0)
	for i := 0; i < 4; i++ {
		c, err := r.br.ReadByte()
		if err != nil {
			return err
		}
		r.code = r.code<<8 | uint32(c)
	}
	return nil
}

func (r *rangeCoder) currentCount(scale uint32) uint32 {
	r.rnge /= scale
	return (r.code - r.low) / r.rnge
}

func (r *rangeCoder) normalize() error {
	for {
		if r.low^(r.low+r.rnge) >= rangeTop {
			if r.rnge >= rangeBottom {
				return nil
			}
			r.rnge = -r.low & (rangeBottom - 1)
		}
		c, err := r.br.ReadByte()
		if err != nil {
			return err
		}
		r.code = r.code<<8 | uint32(c)
		r.rnge <<= 8
		r.low <<= 8
	}
}

func (r *rangeCoder) decode(lowCount, highCount uint32) error {
	r.low += r.rnge * lowCount
	r.rnge *= highCount - lowCount

	return r.normalize()
}

type see2Context struct {
	summ  uint16
	shift byte
	count byte
}

func newSee2Context(i uint16) see2Context {
	return see2Context{i << (periodBits - 4), (periodBits - 4), 4}
}

func (s *see2Context) mean() uint32 {
	if s == nil {
		return 1
	}
	n := s.summ >> s.shift
	if n == 0 {
		return 1
	}
	s.summ -= n
	return uint32(n)
}

func (s *see2Context) update() {
	if s == nil || s.shift >= periodBits {
		return
	}
	s.count--
	if s.count == 0 {
		s.summ += s.summ
		s.count = 3 << s.shift
		s.shift++
	}
}

type state struct {
	sym  byte
	freq byte

	// succ can point to a context or byte in memory.
	// A context pointer is a positive integer. It is an index into the states
	// array that points to the first of two states which the context is
	// marshalled into.
	// A byte pointer is a negative integer. The magnitude represents the position
	// in bytes from the bottom of the memory. As memory is modelled as an array of
	// states, this is used to calculate which state, and where in the state the
	// byte is stored.
	// A zero value represents a nil pointer.
	succ int32
}

// uint16 return a uint16 stored in the sym and freq fields of a state
func (s state) uint16() uint16 { return uint16(s.sym) | uint16(s.freq)<<8 }

// setUint16 stores a uint16 in the sym and freq fields of a state
func (s *state) setUint16(n uint16) { s.sym = byte(n); s.freq = byte(n >> 8) }

// A context is marshalled into a slice of two states.
// The first state contains the number of states, and the suffix pointer.
// If there is only one state, the second state contains that state.
// If there is more than one state, the second state contains the summFreq
// and the index to the slice of states.
// The context is represented by the index into the states array for these two states.
type context int32

// succContext returns a context given a state.succ index
func succContext(i int32) context {
	if i <= 0 {
		return 0
	}
	return context(i)
}

type subAllocator struct {
	// memory for allocation is split into two heaps

	glueCount     int
	heap1MaxBytes int32 // maximum bytes available in heap1
	heap1Lo       int32 // heap1 bottom in number of bytes
	heap1Hi       int32 // heap1 top in number of bytes
	heap2Lo       int32 // heap2 bottom index in states
	heap2Hi       int32 // heap2 top index in states

	// Each freeList entry contains an index into states for the beginning
	// of a free block. The first state in that block may contain an index
	// to another free block and so on. The size of the free block in units
	// (2 states) for that freeList index can be determined from the
	// index2Units array.
	freeList [nIndexes]int32

	// Instead of bytes, memory is represented by a slice of states.
	// context's are marshalled to and from a pair of states.
	// multiple bytes are stored in a state.
	states []state
}

func (a *subAllocator) init(maxMB int) {
	bytes := int32(maxMB) << 20
	heap2Units := bytes / 8 / unitSize * 7
	a.heap1MaxBytes = bytes - heap2Units*unitSize
	// Add one for the case when bytes are not a multiple of unitSize
	heap1Units := a.heap1MaxBytes/unitSize + 1
	// Calculate total size in state's. Add 1 unit so we can reserve the first unit.
	// This will allow us to use the zero index as a nil pointer.
	n := int(1+heap1Units+heap2Units) * 2
	if cap(a.states) > n {
		a.states = a.states[:n]
	} else {
		a.states = make([]state, n)
	}
}

func (a *subAllocator) restart() {
	// Pad heap1 start by 1 unit and enough bytes so that there is no
	// gap between heap1 end and heap2 start.
	a.heap1Lo = unitSize + (unitSize - a.heap1MaxBytes%unitSize)
	a.heap1Hi = unitSize + (a.heap1MaxBytes/unitSize+1)*unitSize
	a.heap2Lo = a.heap1Hi / unitSize * 2
	a.heap2Hi = int32(len(a.states))
	a.glueCount = 0
	for i := range a.freeList {
		a.freeList[i] = 0
	}
}

// pushByte puts a byte on the heap and returns a state.succ index that
// can be used to retrieve it.
func (a *subAllocator) pushByte(c byte) int32 {
	si := a.heap1Lo / 6 // state index
	oi := a.heap1Lo % 6 // byte position in state
	switch oi {
	case 0:
		a.states[si].sym = c
	case 1:
		a.states[si].freq = c
	default:
		n := (uint(oi) - 2) * 8
		mask := ^(uint32(0xFF) << n)
		succ := uint32(a.states[si].succ) & mask
		succ |= uint32(c) << n
		a.states[si].succ = int32(succ)
	}
	a.heap1Lo++
	if a.heap1Lo >= a.heap1Hi {
		return 0
	}
	return -a.heap1Lo
}

// popByte reverses the previous pushByte
func (a *subAllocator) popByte() { a.heap1Lo-- }

// succByte returns a byte from the heap given a state.succ index
func (a *subAllocator) succByte(i int32) byte {
	i = -i
	si := i / 6
	oi := i % 6
	switch oi {
	case 0:
		return a.states[si].sym
	case 1:
		return a.states[si].freq
	default:
		n := (uint(oi) - 2) * 8
		succ := uint32(a.states[si].succ) >> n
		return byte(succ & 0xff)
	}
}

// nextByteAddr takes a state.succ value representing a pointer
// to a byte, and returns the next bytes address
func (a *subAllocator) nextByteAddr(n int32) int32 { return n - 1 }

func (a *subAllocator) removeFreeBlock(i byte) int32 {
	n := a.freeList[i]
	if n != 0 {
		a.freeList[i] = a.states[n].succ
		a.states[n] = state{}
	}
	return n
}

func (a *subAllocator) addFreeBlock(n int32, i byte) {
	a.states[n].succ = a.freeList[i]
	a.freeList[i] = n
}

func (a *subAllocator) freeUnits(n, u int32) {
	i := units2Index[u]
	if u != index2Units[i] {
		i--
		a.addFreeBlock(n, i)
		u -= index2Units[i]
		n += index2Units[i] << 1
		i = units2Index[u]
	}
	a.addFreeBlock(n, i)
}

func (a *subAllocator) glueFreeBlocks() {
	var freeIndex int32

	for i, n := range a.freeList {
		s := state{succ: freeMark}
		s.setUint16(uint16(index2Units[i]))
		for n != 0 {
			states := a.states[n:]
			states[1].succ = freeIndex
			freeIndex = n
			n = states[0].succ
			states[0] = s
		}
		a.freeList[i] = 0
	}

	for i := freeIndex; i != 0; i = a.states[i+1].succ {
		if a.states[i].succ != freeMark {
			continue
		}
		u := int32(a.states[i].uint16())
		states := a.states[i+u<<1:]
		for len(states) > 0 && states[0].succ == freeMark {
			u += int32(states[0].uint16())
			if u > maxUint16 {
				break
			}
			states[0].succ = 0
			a.states[i].setUint16(uint16(u))
			states = a.states[i+u<<1:]
		}
	}

	for n := freeIndex; n != 0; n = a.states[n+1].succ {
		if a.states[n].succ != freeMark {
			continue
		}
		a.states[n].succ = 0
		u := int32(a.states[n].uint16())
		m := n
		for u > 128 {
			a.addFreeBlock(m, nIndexes-1)
			u -= 128
			m += 256
		}
		a.freeUnits(m, u)
	}
}

func (a *subAllocator) allocUnitsRare(index byte) int32 {
	if a.glueCount == 0 {
		a.glueCount = 255
		a.glueFreeBlocks()
		if n := a.removeFreeBlock(index); n > 0 {
			return n
		}
	}
	// try to find a larger free block and split it
	for i := index + 1; i < nIndexes; i++ {
		if n := a.removeFreeBlock(i); n > 0 {
			u := index2Units[i] - index2Units[index]
			a.freeUnits(n+index2Units[index]<<1, u)
			return n
		}
	}
	a.glueCount--

	// try to allocate units from the top of heap1
	n := a.heap1Hi - index2Units[index]*unitSize
	if n > a.heap1Lo {
		a.heap1Hi = n
		return a.heap1Hi / unitSize * 2
	}
	return 0
}

func (a *subAllocator) allocUnits(i byte) int32 {
	// try to allocate a free block
	if n := a.removeFreeBlock(i); n > 0 {
		return n
	}
	// try to allocate from the bottom of heap2
	n := index2Units[i] << 1
	if a.heap2Lo+n <= a.heap2Hi {
		lo := a.heap2Lo
		a.heap2Lo += n
		return lo
	}
	return a.allocUnitsRare(i)
}

func (a *subAllocator) newContext(s state, suffix context) context {
	var n int32
	if a.heap2Lo < a.heap2Hi {
		// allocate from top of heap2
		a.heap2Hi -= 2
		n = a.heap2Hi
	} else if n = a.removeFreeBlock(1); n == 0 {
		if n = a.allocUnitsRare(1); n == 0 {
			return 0
		}
	}
	// we don't need to set numStates to 1 as the default value of 0 in the sym
	// field is always incremented by 1 to get numStates.
	a.states[n] = state{succ: int32(suffix)}
	a.states[n+1] = s
	return context(n)
}

func (a *subAllocator) newContextSize(ns int) context {
	c := a.newContext(state{}, context(0))
	a.contextSetNumStates(c, ns)
	i := units2Index[(ns+1)>>1]
	n := a.allocUnits(i)
	a.contextSetStatesIndex(c, n)
	return c
}

// since number of states is always > 0 && <= 256, we can fit it in a single byte
func (a *subAllocator) contextNumStates(c context) int       { return int(a.states[c].sym) + 1 }
func (a *subAllocator) contextSetNumStates(c context, n int) { a.states[c].sym = byte(n - 1) }

func (a *subAllocator) contextSummFreq(c context) uint16       { return a.states[c+1].uint16() }
func (a *subAllocator) contextSetSummFreq(c context, n uint16) { a.states[c+1].setUint16(n) }
func (a *subAllocator) contextIncSummFreq(c context, n uint16) {
	a.states[c+1].setUint16(a.states[c+1].uint16() + n)
}

func (a *subAllocator) contextSuffix(c context) context { return succContext(a.states[c].succ) }

func (a *subAllocator) contextStatesIndex(c context) int32       { return a.states[c+1].succ }
func (a *subAllocator) contextSetStatesIndex(c context, n int32) { a.states[c+1].succ = n }

func (a *subAllocator) contextStates(c context) []state {
	if ns := int32(a.states[c].sym) + 1; ns != 1 {
		i := a.states[c+1].succ
		return a.states[i : i+ns]
	}
	return a.states[c+1 : c+2]
}

// shrinkStates shrinks the state list down to size states
func (a *subAllocator) shrinkStates(c context, states []state, size int) []state {
	i1 := units2Index[(len(states)+1)>>1]
	i2 := units2Index[(size+1)>>1]

	if size == 1 {
		// store state in context, and free states block
		n := a.contextStatesIndex(c)
		a.states[c+1] = states[0]
		states = a.states[c+1:]
		a.addFreeBlock(n, i1)
	} else if i1 != i2 {
		if n := a.removeFreeBlock(i2); n > 0 {
			// allocate new block and copy
			copy(a.states[n:], states[:size])
			states = a.states[n:]
			// free old block
			a.addFreeBlock(a.contextStatesIndex(c), i1)
			a.contextSetStatesIndex(c, n)
		} else {
			// split current block, and free units not needed
			n = a.contextStatesIndex(c) + index2Units[i2]<<1
			u := index2Units[i1] - index2Units[i2]
			a.freeUnits(n, u)
		}
	}
	a.contextSetNumStates(c, size)
	return states[:size]
}

// expandStates expands the states list by one
func (a *subAllocator) expandStates(c context) []state {
	states := a.contextStates(c)
	ns := len(states)
	if ns == 1 {
		s := states[0]
		n := a.allocUnits(1)
		if n == 0 {
			return nil
		}
		a.contextSetStatesIndex(c, n)
		states = a.states[n:]
		states[0] = s
	} else if ns&0x1 == 0 {
		u := ns >> 1
		i1 := units2Index[u]
		i2 := units2Index[u+1]
		if i1 != i2 {
			n := a.allocUnits(i2)
			if n == 0 {
				return nil
			}
			copy(a.states[n:], states)
			a.addFreeBlock(a.contextStatesIndex(c), i1)
			a.contextSetStatesIndex(c, n)
			states = a.states[n:]
		}
	}
	a.contextSetNumStates(c, ns+1)
	return states[:ns+1]
}

func (a *subAllocator) findState(c context, sym byte) *state {
	var i int
	states := a.contextStates(c)
	for i = range states {
		if states[i].sym == sym {
			break
		}
	}
	return &states[i]
}

type model struct {
	maxOrder    int
	orderFall   int
	initRL      int
	runLength   int
	prevSuccess byte
	escCount    byte
	prevSym     byte
	initEsc     byte
	c           context
	rc          rangeCoder
	a           subAllocator
	charMask    [256]byte
	binSumm     [128][64]uint16
	see2Cont    [25][16]see2Context
	ibuf        [256]int
	sbuf        [256]*state
}

func (m *model) restart() {
	for i := range m.charMask {
		m.charMask[i] = 0
	}
	m.escCount = 1

	if m.maxOrder < 12 {
		m.initRL = -m.maxOrder - 1
	} else {
		m.initRL = -12 - 1
	}
	m.orderFall = m.maxOrder
	m.runLength = m.initRL
	m.prevSuccess = 0

	m.a.restart()

	m.c = m.a.newContextSize(256)
	m.a.contextSetSummFreq(m.c, 257)
	states := m.a.contextStates(m.c)
	for i := range states {
		states[i] = state{sym: byte(i), freq: 1}
	}

	for i := range m.binSumm {
		for j, esc := range initBinEsc {
			n := binScale - esc/(uint16(i)+2)
			for k := j; k < len(m.binSumm[i]); k += len(initBinEsc) {
				m.binSumm[i][k] = n
			}
		}
	}

	for i := range m.see2Cont {
		see := newSee2Context(5*uint16(i) + 10)
		for j := range m.see2Cont[i] {
			m.see2Cont[i][j] = see
		}
	}
}

func (m *model) init(br io.ByteReader, reset bool, maxOrder, maxMB int) error {
	err := m.rc.init(br)
	if err != nil {
		return err
	}
	if !reset {
		return nil
	}

	m.a.init(maxMB)

	if maxOrder == 1 {
		return errCorruptPPM
	}
	m.maxOrder = maxOrder
	m.prevSym = 0
	m.c = 0
	return nil
}

func (m *model) rescale(c context, s *state) *state {
	if s.freq <= maxFreq {
		return s
	}

	var summFreq uint16

	s.freq += 4
	states := m.a.contextStates(c)
	escFreq := m.a.contextSummFreq(c) + 4

	for i := range states {
		f := states[i].freq
		escFreq -= uint16(f)
		if m.orderFall != 0 {
			f++
		}
		f >>= 1
		summFreq += uint16(f)
		states[i].freq = f

		if i == 0 || f <= states[i-1].freq {
			continue
		}
		j := i - 1
		for j > 0 && f > states[j-1].freq {
			j--
		}
		t := states[i]
		copy(states[j+1:i+1], states[j:i])
		states[j] = t
	}

	i := len(states) - 1
	for states[i].freq == 0 {
		i--
		escFreq++
	}
	if i != len(states)-1 {
		states = m.a.shrinkStates(c, states, i+1)
	}
	s = &states[0]
	if i == 0 {
		for {
			s.freq -= s.freq >> 1
			escFreq >>= 1
			if escFreq <= 1 {
				return s
			}
		}
	}
	summFreq += escFreq - (escFreq >> 1)
	m.a.contextSetSummFreq(c, summFreq)
	return s
}

func (m *model) decodeBinSymbol(c context) (*state, error) {
	s := &m.a.contextStates(c)[0]

	ns := m.a.contextNumStates(m.a.contextSuffix(c))
	i := m.prevSuccess + ns2BSIndex[ns-1] + byte(m.runLength>>26)&0x20
	if m.prevSym >= 64 {
		i += 8
	}
	if s.sym >= 64 {
		i += 2 * 8
	}
	bs := &m.binSumm[s.freq-1][i]
	mean := (*bs + 1<<(periodBits-2)) >> periodBits

	if m.rc.currentCount(binScale) < uint32(*bs) {
		err := m.rc.decode(0, uint32(*bs))
		if s.freq < 128 {
			s.freq++
		}
		*bs += 1<<intBits - mean
		m.prevSuccess = 1
		m.runLength++
		return s, err
	}
	err := m.rc.decode(uint32(*bs), binScale)
	*bs -= mean
	m.initEsc = expEscape[*bs>>10]
	m.charMask[s.sym] = m.escCount
	m.prevSuccess = 0
	return nil, err
}

func (m *model) decodeSymbol1(c context) (*state, error) {
	states := m.a.contextStates(c)
	scale := uint32(m.a.contextSummFreq(c))
	// protect against divide by zero
	// TODO: look at why this happens, may be problem elsewhere
	if scale == 0 {
		return nil, errCorruptPPM
	}
	count := m.rc.currentCount(scale)
	m.prevSuccess = 0

	var n uint32
	for i := range states {
		s := &states[i]
		n += uint32(s.freq)
		if n <= count {
			continue
		}
		err := m.rc.decode(n-uint32(s.freq), n)
		s.freq += 4
		m.a.contextSetSummFreq(c, uint16(scale+4))
		if i == 0 {
			if 2*n > scale {
				m.prevSuccess = 1
				m.runLength++
			}
		} else {
			if s.freq <= states[i-1].freq {
				return s, err
			}
			states[i-1], states[i] = states[i], states[i-1]
			s = &states[i-1]
		}
		return m.rescale(c, s), err
	}

	for _, s := range states {
		m.charMask[s.sym] = m.escCount
	}
	return nil, m.rc.decode(n, scale)
}

func (m *model) makeEscFreq(c context, numMasked int) *see2Context {
	ns := m.a.contextNumStates(c)
	if ns == 256 {
		return nil
	}
	diff := ns - numMasked

	var i int
	if m.prevSym >= 64 {
		i = 8
	}
	if diff < m.a.contextNumStates(m.a.contextSuffix(c))-ns {
		i++
	}
	if int(m.a.contextSummFreq(c)) < 11*ns {
		i += 2
	}
	if numMasked > diff {
		i += 4
	}
	return &m.see2Cont[ns2Index[diff-1]][i]
}

func (m *model) decodeSymbol2(c context, numMasked int) (*state, error) {
	see := m.makeEscFreq(c, numMasked)
	scale := see.mean()

	var i int
	var hi uint32
	states := m.a.contextStates(c)
	n := len(states) - numMasked
	sl := m.ibuf[:n]
	for j := range sl {
		for m.charMask[states[i].sym] == m.escCount {
			i++
		}
		hi += uint32(states[i].freq)
		sl[j] = i
		i++
	}

	scale += hi
	count := m.rc.currentCount(scale)

	if count >= scale {
		return nil, errCorruptPPM
	}
	if count >= hi {
		err := m.rc.decode(hi, scale)
		if see != nil {
			see.summ += uint16(scale)
		}
		for _, i := range sl {
			m.charMask[states[i].sym] = m.escCount
		}
		return nil, err
	}

	hi = uint32(states[sl[0]].freq)
	n = 0
	for hi <= count {
		n++
		hi += uint32(states[sl[n]].freq)
	}
	s := &states[sl[n]]

	err := m.rc.decode(hi-uint32(s.freq), hi)

	see.update()

	m.escCount++
	m.runLength = m.initRL

	s.freq += 4
	m.a.contextIncSummFreq(c, 4)
	return m.rescale(c, s), err
}

func (m *model) createSuccessors(c context, s, ss *state) context {
	sl := m.sbuf[:0]

	if m.orderFall != 0 {
		sl = append(sl, s)
	}

	for suff := m.a.contextSuffix(c); suff > 0; suff = m.a.contextSuffix(c) {
		c = suff

		if ss == nil {
			ss = m.a.findState(c, s.sym)
		}
		if ss.succ != s.succ {
			c = succContext(ss.succ)
			break
		}
		sl = append(sl, ss)
		ss = nil
	}

	if len(sl) == 0 {
		return c
	}

	var up state
	up.sym = m.a.succByte(s.succ)
	up.succ = m.a.nextByteAddr(s.succ)

	states := m.a.contextStates(c)
	if len(states) > 1 {
		s = m.a.findState(c, up.sym)

		cf := uint16(s.freq) - 1
		s0 := m.a.contextSummFreq(c) - uint16(len(states)) - cf

		if 2*cf <= s0 {
			if 5*cf > s0 {
				up.freq = 2
			} else {
				up.freq = 1
			}
		} else {
			up.freq = byte(1 + (2*cf+3*s0-1)/(2*s0))
		}
	} else {
		up.freq = states[0].freq
	}

	for i := len(sl) - 1; i >= 0; i-- {
		c = m.a.newContext(up, c)
		if c == 0 {
			return c
		}
		sl[i].succ = int32(c)
	}
	return c
}

func (m *model) update(minC, maxC context, s *state) context {
	if m.orderFall == 0 {
		if s.succ > 0 {
			return context(s.succ)
		}
	}

	if m.escCount == 0 {
		m.escCount = 1
		for i := range m.charMask {
			m.charMask[i] = 0
		}
	}

	var ss *state // matching minC.suffix state

	if s.freq < maxFreq/4 && m.a.contextSuffix(minC) > 0 {
		c := m.a.contextSuffix(minC)
		states := m.a.contextStates(c)

		var i int
		if len(states) > 1 {
			for states[i].sym != s.sym {
				i++
			}
			if i > 0 && states[i].freq >= states[i-1].freq {
				states[i-1], states[i] = states[i], states[i-1]
				i--
			}
			if states[i].freq < maxFreq-9 {
				states[i].freq += 2
				m.a.contextIncSummFreq(c, 2)
			}
		} else if states[0].freq < 32 {
			states[0].freq++
		}
		ss = &states[i] // save later for createSuccessors
	}

	if m.orderFall == 0 {
		minC = m.createSuccessors(minC, s, ss)
		s.succ = int32(minC)
		return minC
	}

	succ := m.a.pushByte(s.sym)
	if succ == 0 {
		return context(0)
	}

	var newC context
	if s.succ == 0 {
		s.succ = succ
		newC = minC
	} else {
		if s.succ > 0 {
			newC = context(s.succ)
		} else {
			newC = m.createSuccessors(minC, s, ss)
			if newC == 0 {
				return context(0)
			}
		}
		m.orderFall--
		if m.orderFall == 0 {
			succ = int32(newC)
			if maxC != minC {
				m.a.popByte()
			}
		}
	}

	n := m.a.contextNumStates(minC)
	s0 := int(m.a.contextSummFreq(minC)) - n - int(s.freq-1)
	for c := maxC; c != minC; c = m.a.contextSuffix(c) {
		var summFreq uint16

		states := m.a.expandStates(c)
		if states == nil {
			return context(0)
		}
		if ns := len(states) - 1; ns != 1 {
			summFreq = m.a.contextSummFreq(c)
			if 4*ns <= n && int(summFreq) <= 8*ns {
				summFreq += 2
			}
			if 2*ns < n {
				summFreq++
			}
		} else {
			p := &states[0]
			if p.freq < maxFreq/4-1 {
				p.freq += p.freq
			} else {
				p.freq = maxFreq - 4
			}
			summFreq = uint16(p.freq) + uint16(m.initEsc)
			if n > 3 {
				summFreq++
			}
		}

		cf := 2 * int(s.freq) * int(summFreq+6)
		sf := s0 + int(summFreq)
		var freq byte
		if cf >= 6*sf {
			switch {
			case cf >= 15*sf:
				freq = 7
			case cf >= 12*sf:
				freq = 6
			case cf >= 9*sf:
				freq = 5
			default:
				freq = 4
			}
			summFreq += uint16(freq)
		} else {
			switch {
			case cf >= 4*sf:
				freq = 3
			case cf > sf:
				freq = 2
			default:
				freq = 1
			}
			summFreq += 3
		}
		states[len(states)-1] = state{sym: s.sym, freq: freq, succ: succ}
		m.a.contextSetSummFreq(c, summFreq)
	}
	return newC
}

func (m *model) ReadByte() (byte, error) {
	if m.c == 0 {
		m.restart()
	}
	minC := m.c
	maxC := minC
	var s *state
	var err error
	if m.a.contextNumStates(minC) == 1 {
		s, err = m.decodeBinSymbol(minC)
	} else {
		s, err = m.decodeSymbol1(minC)
	}
	for s == nil && err == nil {
		n := m.a.contextNumStates(minC)
		for m.a.contextNumStates(minC) == n {
			m.orderFall++
			minC = m.a.contextSuffix(minC)
			if minC <= 0 {
				return 0, errCorruptPPM
			}
		}
		s, err = m.decodeSymbol2(minC, n)
	}
	if err != nil {
		return 0, err
	}

	m.c = m.update(minC, maxC, s)
	m.prevSym = s.sym
	return s.sym, nil
}
