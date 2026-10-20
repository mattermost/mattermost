// Copyright 2014 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package pdf

import (
	"context"
	"errors"
	"io"
	"strings"
)

// A Stack represents a stack of values.
type Stack struct {
	stack []Value
}

func (stk *Stack) Len() int {
	return len(stk.stack)
}

func (stk *Stack) Push(v Value) {
	stk.stack = append(stk.stack, v)
}

func (stk *Stack) Pop() Value {
	n := len(stk.stack)
	if n == 0 {
		return Value{}
	}
	v := stk.stack[n-1]
	stk.stack[n-1] = Value{}
	stk.stack = stk.stack[:n-1]
	return v
}

func newDict() Value {
	return Value{nil, objptr{}, make(dict)}
}

// Interpret interprets the content in a stream as a basic PostScript program,
// pushing values onto a stack and then calling the do function to execute
// operators. The do function may push or pop values from the stack as needed
// to implement op.
//
// Interpret handles the operators "dict", "currentdict", "begin", "end", "def", and "pop" itself.
//
// Interpret is not a full-blown PostScript interpreter. Its job is to handle the
// very limited PostScript found in certain supporting file formats embedded
// in PDF files, such as cmap files that describe the mapping from font code
// points to Unicode code points.
//
// A stream can also be represented by an array of streams. No token spans two
// streams, but operators and operands (e.g. array literals for the "TJ"
// operator) can be split across them, so Interpret reads the streams in
// order into one operand stack.
//
// There is no support for executable blocks, among other limitations.
func Interpret(ctx context.Context, strm Value, do func(stk *Stack, op string)) (err error) {
	defer func() {
		// The lexer's reload raises cancellation mid-token as a panic; return
		// it like the cancellation caught between tokens.
		if r := recover(); r != nil {
			if e, ok := r.(error); !ok || !errors.Is(e, ctx.Err()) {
				panic(r)
			}
			err = ctx.Err()
		}
	}()
	var stk Stack
	var dicts []dict
	b := newBuffer(strings.NewReader(""), 0)
	if strm.Kind() == Array {
		b.streams = strm
	} else {
		b.r = strm.Reader()
	}
	b.ctx = ctx
	b.allowEOF = true
	b.allowObjptr = false
	b.allowStream = false

Reading:
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		tok := b.readToken()
		if tok == io.EOF {
			break
		}
		if kw, ok := tok.(keyword); ok {
			switch kw {
			case "null", "[", "]", "<<", ">>":
			case "dict":
				stk.Pop()
				stk.Push(Value{nil, objptr{}, make(dict)})
				continue
			case "currentdict":
				if len(dicts) == 0 {
					panic("no current dictionary")
				}
				stk.Push(Value{nil, objptr{}, dicts[len(dicts)-1]})
				continue
			case "begin":
				d := stk.Pop()
				if d.Kind() != Dict {
					panic("cannot begin non-dict")
				}
				dicts = append(dicts, d.data.(dict))
				continue
			case "end":
				if len(dicts) <= 0 {
					panic("mismatched begin/end")
				}
				dicts = dicts[:len(dicts)-1]
				continue
			case "def":
				if len(dicts) <= 0 {
					panic("def without open dict")
				}
				val := stk.Pop()
				key, ok := stk.Pop().data.(name)
				if !ok {
					// Skip the value if it has key without value
					continue
				}
				dicts[len(dicts)-1][key] = val.data
				continue
			case "pop":
				stk.Pop()
				continue
			default:
				for i := len(dicts) - 1; i >= 0; i-- {
					if v, ok := dicts[i][name(kw)]; ok {
						stk.Push(Value{nil, objptr{}, v})
						continue Reading
					}
				}
				do(&stk, string(kw))
				continue
			}
		}
		b.unreadToken(tok)
		obj := b.readObject()
		stk.Push(Value{nil, objptr{}, obj})
	}
	return nil
}
