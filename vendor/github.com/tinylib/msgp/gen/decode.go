package gen

import (
	"io"
	"strconv"
)

func decode(w io.Writer) *decodeGen {
	return &decodeGen{
		p:        printer{w: w},
		hasfield: false,
	}
}

type decodeGen struct {
	passes
	p        printer
	hasfield bool
	ctx      *Context
}

func (d *decodeGen) Method() Method { return Decode }

func (d *decodeGen) needsField() {
	if d.hasfield {
		return
	}
	d.p.print("\nvar field []byte; _ = field")
	d.hasfield = true
}

func (d *decodeGen) Execute(p Elem) error {
	p = d.applyall(p)
	if p == nil {
		return nil
	}
	d.hasfield = false
	if !d.p.ok() {
		return d.p.err
	}

	if !IsPrintable(p) {
		return nil
	}

	d.ctx = &Context{}

	d.p.comment("DecodeMsg implements msgp.Decodable")

	d.p.printf("\nfunc (%s %s) DecodeMsg(dc *msgp.Reader) (err error) {", p.Varname(), methodReceiver(p))
	next(d, p)
	d.p.nakedReturn()
	unsetReceiver(p)
	return d.p.err
}

func (d *decodeGen) gStruct(s *Struct) {
	if !d.p.ok() {
		return
	}
	if s.AsTuple {
		d.structAsTuple(s)
	} else {
		d.structAsMap(s)
	}
	return
}

func (d *decodeGen) assignAndCheck(name string, typ string) {
	if !d.p.ok() {
		return
	}
	d.p.printf("\n%s, err = dc.Read%s()", name, typ)
	d.p.wrapErrCheck(d.ctx.ArgsStr())
}

func (d *decodeGen) structAsTuple(s *Struct) {
	nfields := len(s.Fields)

	sz := randIdent()
	d.p.declare(sz, u32)
	d.assignAndCheck(sz, arrayHeader)
	d.p.arrayCheck(strconv.Itoa(nfields), sz)
	for i := range s.Fields {
		if !d.p.ok() {
			return
		}
		d.ctx.PushString(s.Fields[i].FieldName)
		next(d, s.Fields[i].FieldElem)
		d.ctx.Pop()
	}
}

func (d *decodeGen) structAsMap(s *Struct) {
	d.needsField()
	sz := randIdent()
	d.p.declare(sz, u32)
	d.assignAndCheck(sz, mapHeader)

	d.p.printf("\nfor %s > 0 {\n%s--", sz, sz)
	d.assignAndCheck("field", mapKey)
	d.p.print("\nswitch msgp.UnsafeString(field) {")
	for i := range s.Fields {
		d.ctx.PushString(s.Fields[i].FieldName)
		d.p.printf("\ncase \"%s\":", s.Fields[i].FieldTag)
		next(d, s.Fields[i].FieldElem)
		d.ctx.Pop()
		if !d.p.ok() {
			return
		}
	}
	d.p.print("\ndefault:\nerr = dc.Skip()")
	d.p.wrapErrCheck(d.ctx.ArgsStr())

	d.p.closeblock() // close switch
	d.p.closeblock() // close for loop
}

func (d *decodeGen) gBase(b *BaseElem) {
	if !d.p.ok() {
		return
	}

	// open block for 'tmp'
	var tmp string
	if b.Convert {
		tmp = randIdent()
		d.p.printf("\n{ var %s %s", tmp, b.BaseType())
	}

	vname := b.Varname()  // e.g. "z.FieldOne"
	bname := b.BaseName() // e.g. "Float64"

	// handle special cases
	// for object type.
	switch b.Value {
	case Bytes:
		if b.Convert {
			d.p.printf("\n%s, err = dc.ReadBytes([]byte(%s))", tmp, vname)
		} else {
			d.p.printf("\n%s, err = dc.ReadBytes(%s)", vname, vname)
		}
	case IDENT:
		d.p.printf("\nerr = %s.DecodeMsg(dc)", vname)
	case Ext:
		d.p.printf("\nerr = dc.ReadExtension(%s)", vname)
	default:
		if b.Convert {
			d.p.printf("\n%s, err = dc.Read%s()", tmp, bname)
		} else {
			d.p.printf("\n%s, err = dc.Read%s()", vname, bname)
		}
	}
	d.p.wrapErrCheck(d.ctx.ArgsStr())

	// close block for 'tmp'
	if b.Convert {
		if b.ShimMode == Cast {
			d.p.printf("\n%s = %s(%s)\n}", vname, b.FromBase(), tmp)
		} else {
			d.p.printf("\n%s, err = %s(%s)\n}", vname, b.FromBase(), tmp)
			d.p.wrapErrCheck(d.ctx.ArgsStr())
		}
	}
}

func (d *decodeGen) gMap(m *Map) {
	if !d.p.ok() {
		return
	}
	sz := randIdent()

	// resize or allocate map
	d.p.declare(sz, u32)
	d.assignAndCheck(sz, mapHeader)
	d.p.resizeMap(sz, m)

	// for element in map, read string/value
	// pair and assign
	d.p.printf("\nfor %s > 0 {\n%s--", sz, sz)
	d.p.declare(m.Keyidx, "string")
	d.p.declare(m.Validx, m.Value.TypeName())
	d.assignAndCheck(m.Keyidx, stringTyp)
	d.ctx.PushVar(m.Keyidx)
	next(d, m.Value)
	d.p.mapAssign(m)
	d.ctx.Pop()
	d.p.closeblock()
}

func (d *decodeGen) gSlice(s *Slice) {
	if !d.p.ok() {
		return
	}
	sz := randIdent()
	d.p.declare(sz, u32)
	d.assignAndCheck(sz, arrayHeader)
	d.p.resizeSlice(sz, s)
	d.p.rangeBlock(d.ctx, s.Index, s.Varname(), d, s.Els)
}

func (d *decodeGen) gArray(a *Array) {
	if !d.p.ok() {
		return
	}

	// special case if we have [const]byte
	if be, ok := a.Els.(*BaseElem); ok && (be.Value == Byte || be.Value == Uint8) {
		d.p.printf("\nerr = dc.ReadExactBytes((%s)[:])", a.Varname())
		d.p.wrapErrCheck(d.ctx.ArgsStr())
		return
	}
	sz := randIdent()
	d.p.declare(sz, u32)
	d.assignAndCheck(sz, arrayHeader)
	d.p.arrayCheck(coerceArraySize(a.Size), sz)
	d.p.rangeBlock(d.ctx, a.Index, a.Varname(), d, a.Els)
}

func (d *decodeGen) gPtr(p *Ptr) {
	if !d.p.ok() {
		return
	}
	d.p.print("\nif dc.IsNil() {")
	d.p.print("\nerr = dc.ReadNil()")
	d.p.wrapErrCheck(d.ctx.ArgsStr())
	d.p.printf("\n%s = nil\n} else {", p.Varname())
	d.p.initPtr(p)
	next(d, p.Value)
	d.p.closeblock()
}
