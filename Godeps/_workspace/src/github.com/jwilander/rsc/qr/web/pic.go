package web

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"net/http"
	"strconv"
	"strings"

	"code.google.com/p/freetype-go/freetype"
	"github.com/jwilander/rsc/appfs/fs"
	"github.com/jwilander/rsc/qr"
	"github.com/jwilander/rsc/qr/coding"
)

func makeImage(req *http.Request, caption, font string, pt, size, border, scale int, f func(x, y int) uint32) *image.RGBA {
	d := (size + 2*border) * scale
	csize := 0
	if caption != "" {
		if pt == 0 {
			pt = 11
		}
		csize = pt * 2
	}
	c := image.NewRGBA(image.Rect(0, 0, d, d+csize))

	// white
	u := &image.Uniform{C: color.White}
	draw.Draw(c, c.Bounds(), u, image.ZP, draw.Src)

	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			r := image.Rect((x+border)*scale, (y+border)*scale, (x+border+1)*scale, (y+border+1)*scale)
			rgba := f(x, y)
			u.C = color.RGBA{byte(rgba >> 24), byte(rgba >> 16), byte(rgba >> 8), byte(rgba)}
			draw.Draw(c, r, u, image.ZP, draw.Src)
		}
	}

	if csize != 0 {
		if font == "" {
			font = "data/luxisr.ttf"
		}
		ctxt := fs.NewContext(req)
		dat, _, err := ctxt.Read(font)
		if err != nil {
			panic(err)
		}
		tfont, err := freetype.ParseFont(dat)
		if err != nil {
			panic(err)
		}
		ft := freetype.NewContext()
		ft.SetDst(c)
		ft.SetDPI(100)
		ft.SetFont(tfont)
		ft.SetFontSize(float64(pt))
		ft.SetSrc(image.NewUniform(color.Black))
		ft.SetClip(image.Rect(0, 0, 0, 0))
		wid, err := ft.DrawString(caption, freetype.Pt(0, 0))
		if err != nil {
			panic(err)
		}
		p := freetype.Pt(d, d+3*pt/2)
		p.X -= wid.X
		p.X /= 2
		ft.SetClip(c.Bounds())
		ft.DrawString(caption, p)
	}

	return c
}

func makeFrame(req *http.Request, font string, pt, vers, l, scale, dots int) image.Image {
	lev := coding.Level(l)
	p, err := coding.NewPlan(coding.Version(vers), lev, 0)
	if err != nil {
		panic(err)
	}

	nd := p.DataBytes / p.Blocks
	nc := p.CheckBytes / p.Blocks
	extra := p.DataBytes - nd*p.Blocks

	cap := fmt.Sprintf("QR v%d, %s", vers, lev)
	if dots > 0 {
		cap = fmt.Sprintf("QR v%d order, from bottom right", vers)
	}
	m := makeImage(req, cap, font, pt, len(p.Pixel), 0, scale, func(x, y int) uint32 {
		pix := p.Pixel[y][x]
		switch pix.Role() {
		case coding.Data:
			if dots > 0 {
				return 0xffffffff
			}
			off := int(pix.Offset() / 8)
			nd := nd
			var i int
			for i = 0; i < p.Blocks; i++ {
				if i == extra {
					nd++
				}
				if off < nd {
					break
				}
				off -= nd
			}
			return blockColors[i%len(blockColors)]
		case coding.Check:
			if dots > 0 {
				return 0xffffffff
			}
			i := (int(pix.Offset()/8) - p.DataBytes) / nc
			return dark(blockColors[i%len(blockColors)])
		}
		if pix&coding.Black != 0 {
			return 0x000000ff
		}
		return 0xffffffff
	})

	if dots > 0 {
		b := m.Bounds()
		for y := 0; y <= len(p.Pixel); y++ {
			for x := 0; x < b.Dx(); x++ {
				m.SetRGBA(x, y*scale-(y/len(p.Pixel)), color.RGBA{127, 127, 127, 255})
			}
		}
		for x := 0; x <= len(p.Pixel); x++ {
			for y := 0; y < b.Dx(); y++ {
				m.SetRGBA(x*scale-(x/len(p.Pixel)), y, color.RGBA{127, 127, 127, 255})
			}
		}
		order := make([]image.Point, (p.DataBytes+p.CheckBytes)*8+1)
		for y, row := range p.Pixel {
			for x, pix := range row {
				if r := pix.Role(); r != coding.Data && r != coding.Check {
					continue
				}
				//	draw.Draw(m, m.Bounds().Add(image.Pt(x*scale, y*scale)), dot, image.ZP, draw.Over)
				order[pix.Offset()] = image.Point{x*scale + scale/2, y*scale + scale/2}
			}
		}

		for mode := 0; mode < 2; mode++ {
			for i, p := range order {
				q := order[i+1]
				if q.X == 0 {
					break
				}
				line(m, p, q, mode)
			}
		}
	}
	return m
}

func line(m *image.RGBA, p, q image.Point, mode int) {
	x := 0
	y := 0
	dx := q.X - p.X
	dy := q.Y - p.Y
	xsign := +1
	ysign := +1
	if dx < 0 {
		xsign = -1
		dx = -dx
	}
	if dy < 0 {
		ysign = -1
		dy = -dy
	}
	pt := func() {
		switch mode {
		case 0:
			for dx := -2; dx <= 2; dx++ {
				for dy := -2; dy <= 2; dy++ {
					if dy*dx <= -4 || dy*dx >= 4 {
						continue
					}
					m.SetRGBA(p.X+x*xsign+dx, p.Y+y*ysign+dy, color.RGBA{255, 192, 192, 255})
				}
			}

		case 1:
			m.SetRGBA(p.X+x*xsign, p.Y+y*ysign, color.RGBA{128, 0, 0, 255})
		}
	}
	if dx > dy {
		for x < dx || y < dy {
			pt()
			x++
			if float64(x)*float64(dy)/float64(dx)-float64(y) > 0.5 {
				y++
			}
		}
	} else {
		for x < dx || y < dy {
			pt()
			y++
			if float64(y)*float64(dx)/float64(dy)-float64(x) > 0.5 {
				x++
			}
		}
	}
	pt()
}

func pngEncode(c image.Image) []byte {
	var b bytes.Buffer
	png.Encode(&b, c)
	return b.Bytes()
}

// Frame handles a request for a single QR frame.
func Frame(w http.ResponseWriter, req *http.Request) {
	arg := func(s string) int { x, _ := strconv.Atoi(req.FormValue(s)); return x }
	v := arg("v")
	scale := arg("scale")
	if scale == 0 {
		scale = 8
	}

	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write(pngEncode(makeFrame(req, req.FormValue("font"), arg("pt"), v, arg("l"), scale, arg("dots"))))
}

// Frames handles a request for multiple QR frames.
func Frames(w http.ResponseWriter, req *http.Request) {
	vs := strings.Split(req.FormValue("v"), ",")

	arg := func(s string) int { x, _ := strconv.Atoi(req.FormValue(s)); return x }
	scale := arg("scale")
	if scale == 0 {
		scale = 8
	}
	font := req.FormValue("font")
	pt := arg("pt")
	dots := arg("dots")

	var images []image.Image
	l := arg("l")
	for _, v := range vs {
		l := l
		if i := strings.Index(v, "."); i >= 0 {
			l, _ = strconv.Atoi(v[i+1:])
			v = v[:i]
		}
		vv, _ := strconv.Atoi(v)
		images = append(images, makeFrame(req, font, pt, vv, l, scale, dots))
	}

	b := images[len(images)-1].Bounds()

	dx := arg("dx")
	if dx == 0 {
		dx = b.Dx()
	}
	x, y := 0, 0
	xmax := 0
	sep := arg("sep")
	if sep == 0 {
		sep = 10
	}
	var points []image.Point
	for i, m := range images {
		if x > 0 {
			x += sep
		}
		if x > 0 && x+m.Bounds().Dx() > dx {
			y += sep + images[i-1].Bounds().Dy()
			x = 0
		}
		points = append(points, image.Point{x, y})
		x += m.Bounds().Dx()
		if x > xmax {
			xmax = x
		}

	}

	c := image.NewRGBA(image.Rect(0, 0, xmax, y+b.Dy()))
	for i, m := range images {
		draw.Draw(c, c.Bounds().Add(points[i]), m, image.ZP, draw.Src)
	}

	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write(pngEncode(c))
}

// Mask handles a request for a single QR mask.
func Mask(w http.ResponseWriter, req *http.Request) {
	arg := func(s string) int { x, _ := strconv.Atoi(req.FormValue(s)); return x }
	v := arg("v")
	m := arg("m")
	scale := arg("scale")
	if scale == 0 {
		scale = 8
	}

	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write(pngEncode(makeMask(req, req.FormValue("font"), arg("pt"), v, m, scale)))
}

// Masks handles a request for multiple QR masks.
func Masks(w http.ResponseWriter, req *http.Request) {
	arg := func(s string) int { x, _ := strconv.Atoi(req.FormValue(s)); return x }
	v := arg("v")
	scale := arg("scale")
	if scale == 0 {
		scale = 8
	}
	font := req.FormValue("font")
	pt := arg("pt")
	var mm []image.Image
	for m := 0; m < 8; m++ {
		mm = append(mm, makeMask(req, font, pt, v, m, scale))
	}
	dx := mm[0].Bounds().Dx()
	dy := mm[0].Bounds().Dy()

	sep := arg("sep")
	if sep == 0 {
		sep = 10
	}
	c := image.NewRGBA(image.Rect(0, 0, (dx+sep)*4-sep, (dy+sep)*2-sep))
	for m := 0; m < 8; m++ {
		x := (m % 4) * (dx + sep)
		y := (m / 4) * (dy + sep)
		draw.Draw(c, c.Bounds().Add(image.Pt(x, y)), mm[m], image.ZP, draw.Src)
	}

	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write(pngEncode(c))
}

var maskName = []string{
	"(x+y) % 2",
	"y % 2",
	"x % 3",
	"(x+y) % 3",
	"(y/2 + x/3) % 2",
	"xy%2 + xy%3",
	"(xy%2 + xy%3) % 2",
	"(xy%3 + (x+y)%2) % 2",
}

func makeMask(req *http.Request, font string, pt int, vers, mask, scale int) image.Image {
	p, err := coding.NewPlan(coding.Version(vers), coding.L, coding.Mask(mask))
	if err != nil {
		panic(err)
	}
	m := makeImage(req, maskName[mask], font, pt, len(p.Pixel), 0, scale, func(x, y int) uint32 {
		pix := p.Pixel[y][x]
		switch pix.Role() {
		case coding.Data, coding.Check:
			if pix&coding.Invert != 0 {
				return 0x000000ff
			}
		}
		return 0xffffffff
	})
	return m
}

var blockColors = []uint32{
	0x7777ffff,
	0xffff77ff,
	0xff7777ff,
	0x77ffffff,
	0x1e90ffff,
	0xffffe0ff,
	0x8b6969ff,
	0x77ff77ff,
	0x9b30ffff,
	0x00bfffff,
	0x90e890ff,
	0xfff68fff,
	0xffec8bff,
	0xffa07aff,
	0xffa54fff,
	0xeee8aaff,
	0x98fb98ff,
	0xbfbfbfff,
	0x54ff9fff,
	0xffaeb9ff,
	0xb23aeeff,
	0xbbffffff,
	0x7fffd4ff,
	0xff7a7aff,
	0x00007fff,
}

func dark(x uint32) uint32 {
	r, g, b, a := byte(x>>24), byte(x>>16), byte(x>>8), byte(x)
	r = r/2 + r/4
	g = g/2 + g/4
	b = b/2 + b/4
	return uint32(r)<<24 | uint32(g)<<16 | uint32(b)<<8 | uint32(a)
}

func clamp(x int) byte {
	if x < 0 {
		return 0
	}
	if x > 255 {
		return 255
	}
	return byte(x)
}

func max(x, y int) int {
	if x > y {
		return x
	}
	return y
}

// Arrow handles a request for an arrow pointing in a given direction.
func Arrow(w http.ResponseWriter, req *http.Request) {
	arg := func(s string) int { x, _ := strconv.Atoi(req.FormValue(s)); return x }
	dir := arg("dir")
	size := arg("size")
	if size == 0 {
		size = 50
	}
	del := size / 10

	m := image.NewRGBA(image.Rect(0, 0, size, size))

	if dir == 4 {
		draw.Draw(m, m.Bounds(), image.Black, image.ZP, draw.Src)
		draw.Draw(m, image.Rect(5, 5, size-5, size-5), image.White, image.ZP, draw.Src)
	}

	pt := func(x, y int, c color.RGBA) {
		switch dir {
		case 0:
			m.SetRGBA(x, y, c)
		case 1:
			m.SetRGBA(y, size-1-x, c)
		case 2:
			m.SetRGBA(size-1-x, size-1-y, c)
		case 3:
			m.SetRGBA(size-1-y, x, c)
		}
	}

	for y := 0; y < size/2; y++ {
		for x := 0; x < del && x < y; x++ {
			pt(x, y, color.RGBA{0, 0, 0, 255})
		}
		for x := del; x < y-del; x++ {
			pt(x, y, color.RGBA{128, 128, 255, 255})
		}
		for x := max(y-del, 0); x <= y; x++ {
			pt(x, y, color.RGBA{0, 0, 0, 255})
		}
	}
	for y := size / 2; y < size; y++ {
		for x := 0; x < del && x < size-1-y; x++ {
			pt(x, y, color.RGBA{0, 0, 0, 255})
		}
		for x := del; x < size-1-y-del; x++ {
			pt(x, y, color.RGBA{128, 128, 192, 255})
		}
		for x := max(size-1-y-del, 0); x <= size-1-y; x++ {
			pt(x, y, color.RGBA{0, 0, 0, 255})
		}
	}

	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write(pngEncode(m))
}

// Encode encodes a string using the given version, level, and mask.
func Encode(w http.ResponseWriter, req *http.Request) {
	val := func(s string) int {
		v, _ := strconv.Atoi(req.FormValue(s))
		return v
	}

	l := coding.Level(val("l"))
	v := coding.Version(val("v"))
	enc := coding.String(req.FormValue("t"))
	m := coding.Mask(val("m"))
	
	p, err := coding.NewPlan(v, l, m)
	if err != nil {
		panic(err)
	}
	cc, err := p.Encode(enc)
	if err != nil {
		panic(err)
	}
	
	c := &qr.Code{Bitmap: cc.Bitmap, Size: cc.Size, Stride: cc.Stride, Scale: 8}
	w.Header().Set("Content-Type", "image/png")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write(c.PNG())
}

