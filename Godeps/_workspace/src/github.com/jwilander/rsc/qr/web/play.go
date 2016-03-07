// Copyright 2012 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/*
QR data layout

qr/
	upload/
		id.png
		id.fix
	flag/
		id

*/
// TODO: Random seed taken from GET for caching, repeatability.
// TODO: Flag for abuse button + some kind of dashboard.
// TODO: +1 button on web page?  permalink?
// TODO: Flag for abuse button on permalinks too?
// TODO: Make the page prettier.
// TODO: Cache headers.

package web

import (
	"bytes"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html/template"
	"image"
	"image/color"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/jwilander/rsc/appfs/fs"
	"github.com/jwilander/rsc/gf256"
	"github.com/jwilander/rsc/qr"
	"github.com/jwilander/rsc/qr/coding"
	"github.com/jwilander/rsc/qr/web/resize"
)

func runTemplate(c *fs.Context, w http.ResponseWriter, name string, data interface{}) {
	t := template.New("main")

	main, _, err := c.Read(name)
	if err != nil {
		panic(err)
	}
	style, _, _ := c.Read("style.html")
	main = append(main, style...)
	_, err = t.Parse(string(main))
	if err != nil {
		panic(err)
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, &data); err != nil {
		panic(err)
	}
	w.Write(buf.Bytes())
}

func isImgName(s string) bool {
	if len(s) != 32 {
		return false
	}
	for i := 0; i < len(s); i++ {
		if '0' <= s[i] && s[i] <= '9' || 'a' <= s[i] && s[i] <= 'f' {
			continue
		}
		return false
	}
	return true
}

func isTagName(s string) bool {
	if len(s) != 16 {
		return false
	}
	for i := 0; i < len(s); i++ {
		if '0' <= s[i] && s[i] <= '9' || 'a' <= s[i] && s[i] <= 'f' {
			continue
		}
		return false
	}
	return true
}

// Draw is the handler for drawing a QR code.
func Draw(w http.ResponseWriter, req *http.Request) {
	ctxt := fs.NewContext(req)

	url := req.FormValue("url")
	if url == "" {
		url = "http://swtch.com/qr"
	}
	if req.FormValue("upload") == "1" {
		upload(w, req, url)
		return
	}

	t0 := time.Now()
	img := req.FormValue("i")
	if !isImgName(img) {
		img = "pjw"
	}
	if req.FormValue("show") == "png" {
		i := loadSize(ctxt, img, 48)
		var buf bytes.Buffer
		png.Encode(&buf, i)
		w.Write(buf.Bytes())
		return
	}
	if req.FormValue("flag") == "1" {
		flag(w, req, img, ctxt)
		return
	}
	if req.FormValue("x") == "" {
		var data = struct {
			Name string
			URL  string
		}{
			Name: img,
			URL:  url,
		}
		runTemplate(ctxt, w, "qr/main.html", &data)
		return
	}

	arg := func(s string) int { x, _ := strconv.Atoi(req.FormValue(s)); return x }
	targ := makeTarg(ctxt, img, 17+4*arg("v")+arg("z"))

	m := &Image{
		Name:         img,
		Dx:           arg("x"),
		Dy:           arg("y"),
		URL:          req.FormValue("u"),
		Version:      arg("v"),
		Mask:         arg("m"),
		RandControl:  arg("r") > 0,
		Dither:       arg("i") > 0,
		OnlyDataBits: arg("d") > 0,
		SaveControl:  arg("c") > 0,
		Scale:        arg("scale"),
		Target:       targ,
		Seed:         int64(arg("s")),
		Rotation:     arg("o"),
		Size:         arg("z"),
	}
	if m.Version > 8 {
		m.Version = 8
	}

	if m.Scale == 0 {
		if arg("l") > 1 {
			m.Scale = 8
		} else {
			m.Scale = 4
		}
	}
	if m.Version >= 12 && m.Scale >= 4 {
		m.Scale /= 2
	}

	if arg("l") == 1 {
		data, err := json.Marshal(m)
		if err != nil {
			panic(err)
		}
		h := md5.New()
		h.Write(data)
		tag := fmt.Sprintf("%x", h.Sum(nil))[:16]
		if err := ctxt.Write("qrsave/"+tag, data); err != nil {
			panic(err)
		}
		http.Redirect(w, req, "/qr/show/" + tag, http.StatusTemporaryRedirect)
		return
	}

	if err := m.Encode(req); err != nil {
		fmt.Fprintf(w, "%s\n", err)
		return
	}

	var dat []byte
	switch {
	case m.SaveControl:
		dat = m.Control
	default:
		dat = m.Code.PNG()
	}

	if arg("l") > 0 {
		w.Header().Set("Content-Type", "image/png")
		w.Write(dat)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprint(w, "<center><img src=\"data:image/png;base64,")
	io.WriteString(w, base64.StdEncoding.EncodeToString(dat))
	fmt.Fprint(w, "\" /><br>")
	fmt.Fprintf(w, "<form method=\"POST\" action=\"%s&l=1\"><input type=\"submit\" value=\"Save this QR code\"></form>\n", m.Link())
	fmt.Fprintf(w, "</center>\n")
	fmt.Fprintf(w, "<br><center><font size=-1>%v</font></center>\n", time.Now().Sub(t0))
}

func (m *Image) Small() bool {
	return 8*(17+4*int(m.Version)) < 512
}

func (m *Image) Link() string {
	s := fmt.Sprint
	b := func(v bool) string {
		if v {
			return "1"
		}
		return "0"
	}
	val := url.Values{
		"i": {m.Name},
		"x": {s(m.Dx)},
		"y": {s(m.Dy)},
		"z": {s(m.Size)},
		"u": {m.URL},
		"v": {s(m.Version)},
		"m": {s(m.Mask)},
		"r": {b(m.RandControl)},
		"t": {b(m.Dither)},
		"d": {b(m.OnlyDataBits)},
		"c": {b(m.SaveControl)},
		"s": {s(m.Seed)},
	}
	return "/qr/draw?" + val.Encode()
}

// Show is the handler for showing a stored QR code.
func Show(w http.ResponseWriter, req *http.Request) {
	ctxt := fs.NewContext(req)
	tag := req.URL.Path[len("/qr/show/"):]
	png := strings.HasSuffix(tag, ".png")
	if png {
		tag = tag[:len(tag)-len(".png")]
	}
	if !isTagName(tag) {
		fmt.Fprintf(w, "Sorry, QR code not found\n")
		return
	}
	if req.FormValue("flag") == "1" {
		flag(w, req, tag, ctxt)
		return
	}
	data, _, err := ctxt.Read("qrsave/" + tag)
	if err != nil {
		fmt.Fprintf(w, "Sorry, QR code not found.\n")
		return
	}

	var m Image
	if err := json.Unmarshal(data, &m); err != nil {
		panic(err)
	}
	m.Tag = tag

	switch req.FormValue("size") {
	case "big":
		m.Scale *= 2
	case "small":
		m.Scale /= 2
	}

	if png {
		if err := m.Encode(req); err != nil {
			panic(err)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=3600")
		w.Write(m.Code.PNG())
		return
	}

	w.Header().Set("Cache-Control", "public, max-age=300")
	runTemplate(ctxt, w, "qr/permalink.html", &m)
}

func upload(w http.ResponseWriter, req *http.Request, link string) {
	// Upload of a new image.
	// Copied from Moustachio demo.
	f, _, err := req.FormFile("image")
	if err != nil {
		fmt.Fprintf(w, "You need to select an image to upload.\n")
		return
	}
	defer f.Close()

	i, _, err := image.Decode(f)
	if err != nil {
		panic(err)
	}

	// Convert image to 128x128 gray+alpha.
	b := i.Bounds()
	const max = 128
	// If it's gigantic, it's more efficient to downsample first
	// and then resize; resizing will smooth out the roughness.
	var i1 *image.RGBA
	if b.Dx() > 4*max || b.Dy() > 4*max {
		w, h := 2*max, 2*max
		if b.Dx() > b.Dy() {
			h = b.Dy() * h / b.Dx()
		} else {
			w = b.Dx() * w / b.Dy()
		}
		i1 = resize.Resample(i, b, w, h)
	} else {
		// "Resample" to same size, just to convert to RGBA.
		i1 = resize.Resample(i, b, b.Dx(), b.Dy())
	}
	b = i1.Bounds()

	// Encode to PNG.
	dx, dy := 128, 128
	if b.Dx() > b.Dy() {
		dy = b.Dy() * dx / b.Dx()
	} else {
		dx = b.Dx() * dy / b.Dy()
	}
	i128 := resize.ResizeRGBA(i1, i1.Bounds(), dx, dy)

	var buf bytes.Buffer
	if err := png.Encode(&buf, i128); err != nil {
		panic(err)
	}

	h := md5.New()
	h.Write(buf.Bytes())
	tag := fmt.Sprintf("%x", h.Sum(nil))[:32]

	ctxt := fs.NewContext(req)
	if err := ctxt.Write("qr/upload/"+tag+".png", buf.Bytes()); err != nil {
		panic(err)
	}

	// Redirect with new image tag.
	// Redirect to draw with new image tag.
	http.Redirect(w, req, req.URL.Path+"?"+url.Values{"i": {tag}, "url": {link}}.Encode(), 302)
}

func flag(w http.ResponseWriter, req *http.Request, img string, ctxt *fs.Context) {
	if !isImgName(img) && !isTagName(img) {
		fmt.Fprintf(w, "Invalid image.\n")
		return
	}
	data, _, _ := ctxt.Read("qr/flag/" + img)
	data = append(data, '!')
	ctxt.Write("qr/flag/" + img, data)
	
	fmt.Fprintf(w, "Thank you.  The image has been reported.\n")
}

func loadSize(ctxt *fs.Context, name string, max int) *image.RGBA {
	data, _, err := ctxt.Read("qr/upload/" + name + ".png")
	if err != nil {
		panic(err)
	}
	i, _, err := image.Decode(bytes.NewBuffer(data))
	if err != nil {
		panic(err)
	}
	b := i.Bounds()
	dx, dy := max, max
	if b.Dx() > b.Dy() {
		dy = b.Dy() * dx / b.Dx()
	} else {
		dx = b.Dx() * dy / b.Dy()
	}
	var irgba *image.RGBA
	switch i := i.(type) {
	case *image.RGBA:
		irgba = resize.ResizeRGBA(i, i.Bounds(), dx, dy)
	case *image.NRGBA:
		irgba = resize.ResizeNRGBA(i, i.Bounds(), dx, dy)
	}
	return irgba
}

func makeTarg(ctxt *fs.Context, name string, max int) [][]int {
	i := loadSize(ctxt, name, max)
	b := i.Bounds()
	dx, dy := b.Dx(), b.Dy()
	targ := make([][]int, dy)
	arr := make([]int, dx*dy)
	for y := 0; y < dy; y++ {
		targ[y], arr = arr[:dx], arr[dx:]
		row := targ[y]
		for x := 0; x < dx; x++ {
			p := i.Pix[y*i.Stride+4*x:]
			r, g, b, a := p[0], p[1], p[2], p[3]
			if a == 0 {
				row[x] = -1
			} else {
				row[x] = int((299*uint32(r) + 587*uint32(g) + 114*uint32(b) + 500) / 1000)
			}
		}
	}
	return targ
}

type Image struct {
	Name     string
	Target   [][]int
	Dx       int
	Dy       int
	URL      string
	Tag string
	Version  int
	Mask     int
	Scale    int
	Rotation int
	Size     int

	// RandControl says to pick the pixels randomly.
	RandControl bool
	Seed        int64

	// Dither says to dither instead of using threshold pixel layout.
	Dither bool

	// OnlyDataBits says to use only data bits, not check bits.
	OnlyDataBits bool

	// Code is the final QR code.
	Code *qr.Code

	// Control is a PNG showing the pixels that we controlled.
	// Pixels we don't control are grayed out.
	SaveControl bool
	Control     []byte
}

type Pixinfo struct {
	X        int
	Y        int
	Pix      coding.Pixel
	Targ     byte
	DTarg    int
	Contrast int
	HardZero bool
	Block    *BitBlock
	Bit      uint
}

type Pixorder struct {
	Off      int
	Priority int
}

type byPriority []Pixorder

func (x byPriority) Len() int           { return len(x) }
func (x byPriority) Swap(i, j int)      { x[i], x[j] = x[j], x[i] }
func (x byPriority) Less(i, j int) bool { return x[i].Priority > x[j].Priority }

func (m *Image) target(x, y int) (targ byte, contrast int) {
	tx := x + m.Dx
	ty := y + m.Dy
	if ty < 0 || ty >= len(m.Target) || tx < 0 || tx >= len(m.Target[ty]) {
		return 255, -1
	}

	v0 := m.Target[ty][tx]
	if v0 < 0 {
		return 255, -1
	}
	targ = byte(v0)

	n := 0
	sum := 0
	sumsq := 0
	const del = 5
	for dy := -del; dy <= del; dy++ {
		for dx := -del; dx <= del; dx++ {
			if 0 <= ty+dy && ty+dy < len(m.Target) && 0 <= tx+dx && tx+dx < len(m.Target[ty+dy]) {
				v := m.Target[ty+dy][tx+dx]
				sum += v
				sumsq += v * v
				n++
			}
		}
	}

	avg := sum / n
	contrast = sumsq/n - avg*avg
	return
}

func (m *Image) rotate(p *coding.Plan, rot int) {
	if rot == 0 {
		return
	}

	N := len(p.Pixel)
	pix := make([][]coding.Pixel, N)
	apix := make([]coding.Pixel, N*N)
	for i := range pix {
		pix[i], apix = apix[:N], apix[N:]
	}

	switch rot {
	case 0:
		// ok
	case 1:
		for y := 0; y < N; y++ {
			for x := 0; x < N; x++ {
				pix[y][x] = p.Pixel[x][N-1-y]
			}
		}
	case 2:
		for y := 0; y < N; y++ {
			for x := 0; x < N; x++ {
				pix[y][x] = p.Pixel[N-1-y][N-1-x]
			}
		}
	case 3:
		for y := 0; y < N; y++ {
			for x := 0; x < N; x++ {
				pix[y][x] = p.Pixel[N-1-x][y]
			}
		}
	}

	p.Pixel = pix
}

func (m *Image) Encode(req *http.Request) error {
	p, err := coding.NewPlan(coding.Version(m.Version), coding.L, coding.Mask(m.Mask))
	if err != nil {
		return err
	}

	m.rotate(p, m.Rotation)

	rand := rand.New(rand.NewSource(m.Seed))

	// QR parameters.
	nd := p.DataBytes / p.Blocks
	nc := p.CheckBytes / p.Blocks
	extra := p.DataBytes - nd*p.Blocks
	rs := gf256.NewRSEncoder(coding.Field, nc)

	// Build information about pixels, indexed by data/check bit number.
	pixByOff := make([]Pixinfo, (p.DataBytes+p.CheckBytes)*8)
	expect := make([][]bool, len(p.Pixel))
	for y, row := range p.Pixel {
		expect[y] = make([]bool, len(row))
		for x, pix := range row {
			targ, contrast := m.target(x, y)
			if m.RandControl && contrast >= 0 {
				contrast = rand.Intn(128) + 64*((x+y)%2) + 64*((x+y)%3%2)
			}
			expect[y][x] = pix&coding.Black != 0
			if r := pix.Role(); r == coding.Data || r == coding.Check {
				pixByOff[pix.Offset()] = Pixinfo{X: x, Y: y, Pix: pix, Targ: targ, Contrast: contrast}
			}
		}
	}

Again:
	// Count fixed initial data bits, prepare template URL.
	url := m.URL + "#"
	var b coding.Bits
	coding.String(url).Encode(&b, p.Version)
	coding.Num("").Encode(&b, p.Version)
	bbit := b.Bits()
	dbit := p.DataBytes*8 - bbit
	if dbit < 0 {
		return fmt.Errorf("cannot encode URL into available bits")
	}
	num := make([]byte, dbit/10*3)
	for i := range num {
		num[i] = '0'
	}
	b.Pad(dbit)
	b.Reset()
	coding.String(url).Encode(&b, p.Version)
	coding.Num(num).Encode(&b, p.Version)
	b.AddCheckBytes(p.Version, p.Level)
	data := b.Bytes()

	doff := 0 // data offset
	coff := 0 // checksum offset
	mbit := bbit + dbit/10*10

	// Choose pixels.
	bitblocks := make([]*BitBlock, p.Blocks)
	for blocknum := 0; blocknum < p.Blocks; blocknum++ {
		if blocknum == p.Blocks-extra {
			nd++
		}

		bdata := data[doff/8 : doff/8+nd]
		cdata := data[p.DataBytes+coff/8 : p.DataBytes+coff/8+nc]
		bb := newBlock(nd, nc, rs, bdata, cdata)
		bitblocks[blocknum] = bb

		// Determine which bits in this block we can try to edit.
		lo, hi := 0, nd*8
		if lo < bbit-doff {
			lo = bbit - doff
			if lo > hi {
				lo = hi
			}
		}
		if hi > mbit-doff {
			hi = mbit - doff
			if hi < lo {
				hi = lo
			}
		}

		// Preserve [0, lo) and [hi, nd*8).
		for i := 0; i < lo; i++ {
			if !bb.canSet(uint(i), (bdata[i/8]>>uint(7-i&7))&1) {
				return fmt.Errorf("cannot preserve required bits")
			}
		}
		for i := hi; i < nd*8; i++ {
			if !bb.canSet(uint(i), (bdata[i/8]>>uint(7-i&7))&1) {
				return fmt.Errorf("cannot preserve required bits")
			}
		}

		// Can edit [lo, hi) and checksum bits to hit target.
		// Determine which ones to try first.
		order := make([]Pixorder, (hi-lo)+nc*8)
		for i := lo; i < hi; i++ {
			order[i-lo].Off = doff + i
		}
		for i := 0; i < nc*8; i++ {
			order[hi-lo+i].Off = p.DataBytes*8 + coff + i
		}
		if m.OnlyDataBits {
			order = order[:hi-lo]
		}
		for i := range order {
			po := &order[i]
			po.Priority = pixByOff[po.Off].Contrast<<8 | rand.Intn(256)
		}
		sort.Sort(byPriority(order))

		const mark = false
		for i := range order {
			po := &order[i]
			pinfo := &pixByOff[po.Off]
			bval := pinfo.Targ
			if bval < 128 {
				bval = 1
			} else {
				bval = 0
			}
			pix := pinfo.Pix
			if pix&coding.Invert != 0 {
				bval ^= 1
			}
			if pinfo.HardZero {
				bval = 0
			}

			var bi int
			if pix.Role() == coding.Data {
				bi = po.Off - doff
			} else {
				bi = po.Off - p.DataBytes*8 - coff + nd*8
			}
			if bb.canSet(uint(bi), bval) {
				pinfo.Block = bb
				pinfo.Bit = uint(bi)
				if mark {
					p.Pixel[pinfo.Y][pinfo.X] = coding.Black
				}
			} else {
				if pinfo.HardZero {
					panic("hard zero")
				}
				if mark {
					p.Pixel[pinfo.Y][pinfo.X] = 0
				}
			}
		}
		bb.copyOut()

		const cheat = false
		for i := 0; i < nd*8; i++ {
			pinfo := &pixByOff[doff+i]
			pix := p.Pixel[pinfo.Y][pinfo.X]
			if bb.B[i/8]&(1<<uint(7-i&7)) != 0 {
				pix ^= coding.Black
			}
			expect[pinfo.Y][pinfo.X] = pix&coding.Black != 0
			if cheat {
				p.Pixel[pinfo.Y][pinfo.X] = pix & coding.Black
			}
		}
		for i := 0; i < nc*8; i++ {
			pinfo := &pixByOff[p.DataBytes*8+coff+i]
			pix := p.Pixel[pinfo.Y][pinfo.X]
			if bb.B[nd+i/8]&(1<<uint(7-i&7)) != 0 {
				pix ^= coding.Black
			}
			expect[pinfo.Y][pinfo.X] = pix&coding.Black != 0
			if cheat {
				p.Pixel[pinfo.Y][pinfo.X] = pix & coding.Black
			}
		}
		doff += nd * 8
		coff += nc * 8
	}

	// Pass over all pixels again, dithering.
	if m.Dither {
		for i := range pixByOff {
			pinfo := &pixByOff[i]
			pinfo.DTarg = int(pinfo.Targ)
		}
		for y, row := range p.Pixel {
			for x, pix := range row {
				if pix.Role() != coding.Data && pix.Role() != coding.Check {
					continue
				}
				pinfo := &pixByOff[pix.Offset()]
				if pinfo.Block == nil {
					// did not choose this pixel
					continue
				}

				pix := pinfo.Pix

				pval := byte(1) // pixel value (black)
				v := 0          // gray value (black)
				targ := pinfo.DTarg
				if targ >= 128 {
					// want white
					pval = 0
					v = 255
				}

				bval := pval // bit value
				if pix&coding.Invert != 0 {
					bval ^= 1
				}
				if pinfo.HardZero && bval != 0 {
					bval ^= 1
					pval ^= 1
					v ^= 255
				}

				// Set pixel value as we want it.
				pinfo.Block.reset(pinfo.Bit, bval)

				_, _ = x, y

				err := targ - v
				if x+1 < len(row) {
					addDither(pixByOff, row[x+1], err*7/16)
				}
				if false && y+1 < len(p.Pixel) {
					if x > 0 {
						addDither(pixByOff, p.Pixel[y+1][x-1], err*3/16)
					}
					addDither(pixByOff, p.Pixel[y+1][x], err*5/16)
					if x+1 < len(row) {
						addDither(pixByOff, p.Pixel[y+1][x+1], err*1/16)
					}
				}
			}
		}

		for _, bb := range bitblocks {
			bb.copyOut()
		}
	}

	noops := 0
	// Copy numbers back out.
	for i := 0; i < dbit/10; i++ {
		// Pull out 10 bits.
		v := 0
		for j := 0; j < 10; j++ {
			bi := uint(bbit + 10*i + j)
			v <<= 1
			v |= int((data[bi/8] >> (7 - bi&7)) & 1)
		}
		// Turn into 3 digits.
		if v >= 1000 {
			// Oops - too many 1 bits.
			// We know the 512, 256, 128, 64, 32 bits are all set.
			// Pick one at random to clear.  This will break some
			// checksum bits, but so be it.
			println("oops", i, v)
			pinfo := &pixByOff[bbit+10*i+3] // TODO random
			pinfo.Contrast = 1e9 >> 8
			pinfo.HardZero = true
			noops++
		}
		num[i*3+0] = byte(v/100 + '0')
		num[i*3+1] = byte(v/10%10 + '0')
		num[i*3+2] = byte(v%10 + '0')
	}
	if noops > 0 {
		goto Again
	}

	var b1 coding.Bits
	coding.String(url).Encode(&b1, p.Version)
	coding.Num(num).Encode(&b1, p.Version)
	b1.AddCheckBytes(p.Version, p.Level)
	if !bytes.Equal(b.Bytes(), b1.Bytes()) {
		fmt.Printf("mismatch\n%d %x\n%d %x\n", len(b.Bytes()), b.Bytes(), len(b1.Bytes()), b1.Bytes())
		panic("byte mismatch")
	}

	cc, err := p.Encode(coding.String(url), coding.Num(num))
	if err != nil {
		return err
	}

	if !m.Dither {
		for y, row := range expect {
			for x, pix := range row {
				if cc.Black(x, y) != pix {
					println("mismatch", x, y, p.Pixel[y][x].String())
				}
			}
		}
	}

	m.Code = &qr.Code{Bitmap: cc.Bitmap, Size: cc.Size, Stride: cc.Stride, Scale: m.Scale}

	if m.SaveControl {
		m.Control = pngEncode(makeImage(req, "", "", 0, cc.Size, 4, m.Scale, func(x, y int) (rgba uint32) {
			pix := p.Pixel[y][x]
			if pix.Role() == coding.Data || pix.Role() == coding.Check {
				pinfo := &pixByOff[pix.Offset()]
				if pinfo.Block != nil {
					if cc.Black(x, y) {
						return 0x000000ff
					}
					return 0xffffffff
				}
			}
			if cc.Black(x, y) {
				return 0x3f3f3fff
			}
			return 0xbfbfbfff
		}))
	}

	return nil
}

func addDither(pixByOff []Pixinfo, pix coding.Pixel, err int) {
	if pix.Role() != coding.Data && pix.Role() != coding.Check {
		return
	}
	pinfo := &pixByOff[pix.Offset()]
	println("add", pinfo.X, pinfo.Y, pinfo.DTarg, err)
	pinfo.DTarg += err
}

func readTarget(name string) ([][]int, error) {
	f, err := os.Open(name)
	if err != nil {
		return nil, err
	}
	m, err := png.Decode(f)
	if err != nil {
		return nil, fmt.Errorf("decode %s: %v", name, err)
	}
	rect := m.Bounds()
	target := make([][]int, rect.Dy())
	for i := range target {
		target[i] = make([]int, rect.Dx())
	}
	for y, row := range target {
		for x := range row {
			a := int(color.RGBAModel.Convert(m.At(x, y)).(color.RGBA).A)
			t := int(color.GrayModel.Convert(m.At(x, y)).(color.Gray).Y)
			if a == 0 {
				t = -1
			}
			row[x] = t
		}
	}
	return target, nil
}

type BitBlock struct {
	DataBytes  int
	CheckBytes int
	B          []byte
	M          [][]byte
	Tmp        []byte
	RS         *gf256.RSEncoder
	bdata      []byte
	cdata      []byte
}

func newBlock(nd, nc int, rs *gf256.RSEncoder, dat, cdata []byte) *BitBlock {
	b := &BitBlock{
		DataBytes:  nd,
		CheckBytes: nc,
		B:          make([]byte, nd+nc),
		Tmp:        make([]byte, nc),
		RS:         rs,
		bdata:      dat,
		cdata:      cdata,
	}
	copy(b.B, dat)
	rs.ECC(b.B[:nd], b.B[nd:])
	b.check()
	if !bytes.Equal(b.Tmp, cdata) {
		panic("cdata")
	}

	b.M = make([][]byte, nd*8)
	for i := range b.M {
		row := make([]byte, nd+nc)
		b.M[i] = row
		for j := range row {
			row[j] = 0
		}
		row[i/8] = 1 << (7 - uint(i%8))
		rs.ECC(row[:nd], row[nd:])
	}
	return b
}

func (b *BitBlock) check() {
	b.RS.ECC(b.B[:b.DataBytes], b.Tmp)
	if !bytes.Equal(b.B[b.DataBytes:], b.Tmp) {
		fmt.Printf("ecc mismatch\n%x\n%x\n", b.B[b.DataBytes:], b.Tmp)
		panic("mismatch")
	}
}

func (b *BitBlock) reset(bi uint, bval byte) {
	if (b.B[bi/8]>>(7-bi&7))&1 == bval {
		// already has desired bit
		return
	}
	// rows that have already been set
	m := b.M[len(b.M):cap(b.M)]
	for _, row := range m {
		if row[bi/8]&(1<<(7-bi&7)) != 0 {
			// Found it.
			for j, v := range row {
				b.B[j] ^= v
			}
			return
		}
	}
	panic("reset of unset bit")
}

func (b *BitBlock) canSet(bi uint, bval byte) bool {
	found := false
	m := b.M
	for j, row := range m {
		if row[bi/8]&(1<<(7-bi&7)) == 0 {
			continue
		}
		if !found {
			found = true
			if j != 0 {
				m[0], m[j] = m[j], m[0]
			}
			continue
		}
		for k := range row {
			row[k] ^= m[0][k]
		}
	}
	if !found {
		return false
	}

	targ := m[0]

	// Subtract from saved-away rows too.
	for _, row := range m[len(m):cap(m)] {
		if row[bi/8]&(1<<(7-bi&7)) == 0 {
			continue
		}
		for k := range row {
			row[k] ^= targ[k]
		}
	}

	// Found a row with bit #bi == 1 and cut that bit from all the others.
	// Apply to data and remove from m.
	if (b.B[bi/8]>>(7-bi&7))&1 != bval {
		for j, v := range targ {
			b.B[j] ^= v
		}
	}
	b.check()
	n := len(m) - 1
	m[0], m[n] = m[n], m[0]
	b.M = m[:n]

	for _, row := range b.M {
		if row[bi/8]&(1<<(7-bi&7)) != 0 {
			panic("did not reduce")
		}
	}

	return true
}

func (b *BitBlock) copyOut() {
	b.check()
	copy(b.bdata, b.B[:b.DataBytes])
	copy(b.cdata, b.B[b.DataBytes:])
}

func showtable(w http.ResponseWriter, b *BitBlock, gray func(int) bool) {
	nd := b.DataBytes
	nc := b.CheckBytes

	fmt.Fprintf(w, "<table class='matrix' cellspacing=0 cellpadding=0 border=0>\n")
	line := func() {
		fmt.Fprintf(w, "<tr height=1 bgcolor='#bbbbbb'><td colspan=%d>\n", (nd+nc)*8)
	}
	line()
	dorow := func(row []byte) {
		fmt.Fprintf(w, "<tr>\n")
		for i := 0; i < (nd+nc)*8; i++ {
			fmt.Fprintf(w, "<td")
			v := row[i/8] >> uint(7-i&7) & 1
			if gray(i) {
				fmt.Fprintf(w, " class='gray'")
			}
			fmt.Fprintf(w, ">")
			if v == 1 {
				fmt.Fprintf(w, "1")
			}
		}
		line()
	}

	m := b.M[len(b.M):cap(b.M)]
	for i := len(m) - 1; i >= 0; i-- {
		dorow(m[i])
	}
	m = b.M
	for _, row := range b.M {
		dorow(row)
	}

	fmt.Fprintf(w, "</table>\n")
}

func BitsTable(w http.ResponseWriter, req *http.Request) {
	nd := 2
	nc := 2
	fmt.Fprintf(w, `<html>
		<style type='text/css'>
		.matrix {
			font-family: sans-serif;
			font-size: 0.8em;
		}
		table.matrix {
			padding-left: 1em;
			padding-right: 1em;
			padding-top: 1em;
			padding-bottom: 1em;
		}
		.matrix td {
			padding-left: 0.3em;
			padding-right: 0.3em;
			border-left: 2px solid white;
			border-right: 2px solid white;
			text-align: center;
			color: #aaa;
		}
		.matrix td.gray {
			color: black;
			background-color: #ddd;
		}
		</style>
	`)
	rs := gf256.NewRSEncoder(coding.Field, nc)
	dat := make([]byte, nd+nc)
	b := newBlock(nd, nc, rs, dat[:nd], dat[nd:])
	for i := 0; i < nd*8; i++ {
		b.canSet(uint(i), 0)
	}
	showtable(w, b, func(i int) bool { return i < nd*8 })

	b = newBlock(nd, nc, rs, dat[:nd], dat[nd:])
	for j := 0; j < (nd+nc)*8; j += 2 {
		b.canSet(uint(j), 0)
	}
	showtable(w, b, func(i int) bool { return i%2 == 0 })

}
