// +build ignore

package pkg

//immut:type T

type T struct {
	a int
	b map[string]int
	c *T
	d []int
	e int
	f int
	g int
	h *T3
	i map[string]*T
}

func (t *T) Mut() {
	t.a++
}

type t2 struct {
	x *int
}

type T3 struct {
	x int
}

func gen() *T { return nil }

func (t *T) Mut2(t3 *T3) {
	// all of these should flag, they're fairly direct mutations of T
	t.a++
	t.b[""] = 1
	t.b[""]++
	t.c.a++
	t.d[2] = 1
	x := &t.e
	*x++
	y := &t.f
	if false {
		y = nil
	}
	*y++

	// should flag, because &t.g is immutable
	z := t2{&t.g}
	*z.x++

	// should flag, because it's addressed through the immutable T
	t.h.x++

	// should not flag, because T3 is not immutable
	t3.x++

	// should flag
	t.i[""].a++ // FLAGGED

	// should flag, inc is known to mutate its param
	inc(&t.a)

	// should flag, add is known to mutate its param
	add(t.b)
}

func inc(x *int) {
	*x++
}

func add(m map[string]int) {
	m[""] = 0
}
