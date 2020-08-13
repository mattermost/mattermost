package gen

import (
	"io"
	"strconv"
)

func unmarshal(w io.Writer) *unmarshalGen {
	return &unmarshalGen{
		p: printer{w: w},
	}
}

type unmarshalGen struct {
	passes
	p        printer
	hasfield bool
	ctx      *Context
}

func (u *unmarshalGen) Method() Method { return Unmarshal }

func (u *unmarshalGen) needsField() {
	if u.hasfield {
		return
	}
	u.p.print("\nvar field []byte; _ = field")
	u.hasfield = true
}

func (u *unmarshalGen) Execute(p Elem) error {
	u.hasfield = false
	if !u.p.ok() {
		return u.p.err
	}
	p = u.applyall(p)
	if p == nil {
		return nil
	}
	if !IsPrintable(p) {
		return nil
	}

	u.ctx = &Context{}

	u.p.comment("UnmarshalMsg implements msgp.Unmarshaler")

	u.p.printf("\nfunc (%s %s) UnmarshalMsg(bts []byte) (o []byte, err error) {", p.Varname(), methodReceiver(p))
	next(u, p)
	u.p.print("\no = bts")
	u.p.nakedReturn()
	unsetReceiver(p)
	return u.p.err
}

// does assignment to the variable "name" with the type "base"
func (u *unmarshalGen) assignAndCheck(name string, base string) {
	if !u.p.ok() {
		return
	}
	u.p.printf("\n%s, bts, err = msgp.Read%sBytes(bts)", name, base)
	u.p.wrapErrCheck(u.ctx.ArgsStr())
}

func (u *unmarshalGen) gStruct(s *Struct) {
	if !u.p.ok() {
		return
	}
	if s.AsTuple {
		u.tuple(s)
	} else {
		u.mapstruct(s)
	}
	return
}

func (u *unmarshalGen) tuple(s *Struct) {

	// open block
	sz := randIdent()
	u.p.declare(sz, u32)
	u.assignAndCheck(sz, arrayHeader)
	u.p.arrayCheck(strconv.Itoa(len(s.Fields)), sz)
	for i := range s.Fields {
		if !u.p.ok() {
			return
		}
		u.ctx.PushString(s.Fields[i].FieldName)
		next(u, s.Fields[i].FieldElem)
		u.ctx.Pop()
	}
}

func (u *unmarshalGen) mapstruct(s *Struct) {
	u.needsField()
	sz := randIdent()
	u.p.declare(sz, u32)
	u.assignAndCheck(sz, mapHeader)

	u.p.printf("\nfor %s > 0 {", sz)
	u.p.printf("\n%s--; field, bts, err = msgp.ReadMapKeyZC(bts)", sz)
	u.p.wrapErrCheck(u.ctx.ArgsStr())
	u.p.print("\nswitch msgp.UnsafeString(field) {")
	for i := range s.Fields {
		if !u.p.ok() {
			return
		}
		u.p.printf("\ncase \"%s\":", s.Fields[i].FieldTag)
		u.ctx.PushString(s.Fields[i].FieldName)
		next(u, s.Fields[i].FieldElem)
		u.ctx.Pop()
	}
	u.p.print("\ndefault:\nbts, err = msgp.Skip(bts)")
	u.p.wrapErrCheck(u.ctx.ArgsStr())
	u.p.print("\n}\n}") // close switch and for loop
}

func (u *unmarshalGen) gBase(b *BaseElem) {
	if !u.p.ok() {
		return
	}

	refname := b.Varname() // assigned to
	lowered := b.Varname() // passed as argument
	if b.Convert {
		// begin 'tmp' block
		refname = randIdent()
		lowered = b.ToBase() + "(" + lowered + ")"
		u.p.printf("\n{\nvar %s %s", refname, b.BaseType())
	}

	switch b.Value {
	case Bytes:
		u.p.printf("\n%s, bts, err = msgp.ReadBytesBytes(bts, %s)", refname, lowered)
	case Ext:
		u.p.printf("\nbts, err = msgp.ReadExtensionBytes(bts, %s)", lowered)
	case IDENT:
		u.p.printf("\nbts, err = %s.UnmarshalMsg(bts)", lowered)
	default:
		u.p.printf("\n%s, bts, err = msgp.Read%sBytes(bts)", refname, b.BaseName())
	}
	u.p.wrapErrCheck(u.ctx.ArgsStr())

	if b.Convert {
		// close 'tmp' block
		if b.ShimMode == Cast {
			u.p.printf("\n%s = %s(%s)\n", b.Varname(), b.FromBase(), refname)
		} else {
			u.p.printf("\n%s, err = %s(%s)", b.Varname(), b.FromBase(), refname)
			u.p.wrapErrCheck(u.ctx.ArgsStr())
		}
		u.p.printf("}")
	}
}

func (u *unmarshalGen) gArray(a *Array) {
	if !u.p.ok() {
		return
	}

	// special case for [const]byte objects
	// see decode.go for symmetry
	if be, ok := a.Els.(*BaseElem); ok && be.Value == Byte {
		u.p.printf("\nbts, err = msgp.ReadExactBytes(bts, (%s)[:])", a.Varname())
		u.p.wrapErrCheck(u.ctx.ArgsStr())
		return
	}

	sz := randIdent()
	u.p.declare(sz, u32)
	u.assignAndCheck(sz, arrayHeader)
	u.p.arrayCheck(coerceArraySize(a.Size), sz)
	u.p.rangeBlock(u.ctx, a.Index, a.Varname(), u, a.Els)
}

func (u *unmarshalGen) gSlice(s *Slice) {
	if !u.p.ok() {
		return
	}
	sz := randIdent()
	u.p.declare(sz, u32)
	u.assignAndCheck(sz, arrayHeader)
	u.p.resizeSlice(sz, s)
	u.p.rangeBlock(u.ctx, s.Index, s.Varname(), u, s.Els)
}

func (u *unmarshalGen) gMap(m *Map) {
	if !u.p.ok() {
		return
	}
	sz := randIdent()
	u.p.declare(sz, u32)
	u.assignAndCheck(sz, mapHeader)

	// allocate or clear map
	u.p.resizeMap(sz, m)

	// loop and get key,value
	u.p.printf("\nfor %s > 0 {", sz)
	u.p.printf("\nvar %s string; var %s %s; %s--", m.Keyidx, m.Validx, m.Value.TypeName(), sz)
	u.assignAndCheck(m.Keyidx, stringTyp)
	u.ctx.PushVar(m.Keyidx)
	next(u, m.Value)
	u.ctx.Pop()
	u.p.mapAssign(m)
	u.p.closeblock()
}

func (u *unmarshalGen) gPtr(p *Ptr) {
	u.p.printf("\nif msgp.IsNil(bts) { bts, err = msgp.ReadNilBytes(bts); if err != nil { return }; %s = nil; } else { ", p.Varname())
	u.p.initPtr(p)
	next(u, p.Value)
	u.p.closeblock()
}
