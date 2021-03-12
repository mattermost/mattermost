// +build !js

package psd

import (
	"io"
	"runtime"
	"sync"
)

func decodePackBits(dest []byte, r io.Reader, width int, lines int, large bool) (read int, err error) {
	buf := make([]byte, lines*(get4or8(large)>>1))
	var l int
	if l, err = io.ReadFull(r, buf); err != nil {
		return
	}
	read += l

	total := 0
	lens := make([]int, lines)
	offsets := make([]int, lines)
	ofs := 0
	if large {
		for i := range lens {
			l = int(readUint32(buf, ofs))
			lens[i] = l
			offsets[i] = total
			total += l
			ofs += 4
		}
	} else {
		for i := range lens {
			l = int(readUint16(buf, ofs))
			lens[i] = l
			offsets[i] = total
			total += l
			ofs += 2
		}
	}

	buf = make([]byte, total)
	if l, err = io.ReadFull(r, buf); err != nil {
		return
	}
	read += l

	n := runtime.GOMAXPROCS(0)
	for n > 1 && n<<1 > lines {
		n--
	}
	if n == 1 {
		err = decodePackBitsPerLine(dest, buf, lens)
		return
	}

	var wg sync.WaitGroup
	errs := make([]error, n)
	wg.Add(n)
	step := lines / n
	ofs = 0
	for i := 1; i < n; i++ {
		go func(index int, dest []byte, buf []byte, lens []int) {
			defer wg.Done()
			errs[index] = decodePackBitsPerLine(dest, buf, lens)
		}(i-1, dest[ofs*width:(ofs+step)*width], buf[offsets[ofs]:offsets[ofs+step]], lens[ofs:ofs+step])
		ofs += step
	}
	go func() {
		defer wg.Done()
		errs[n-1] = decodePackBitsPerLine(dest[ofs*width:], buf[offsets[ofs]:], lens[ofs:])
	}()
	wg.Wait()
	for i := 0; i < n; i++ {
		if errs[i] != nil {
			err = errs[i]
			break
		}
	}
	return
}

func decodePackBitsPerLine(dest []byte, buf []byte, lens []int) error {
	var l int
	for _, ln := range lens {
		for i := 0; i < ln; {
			if buf[i] <= 0x7f {
				l = int(buf[i]) + 1
				if len(dest) < l || ln-i-1 < l {
					return errBrokenPackBits
				}
				copy(dest[:l], buf[i+1:])
				dest = dest[l:]
				i += l + 1
				continue
			}
			if buf[i] == 0x80 {
				i++
				continue
			}
			l = int(-buf[i]) + 1
			if len(dest) < l || i+1 >= ln {
				return errBrokenPackBits
			}
			for j, c := 0, buf[i+1]; j < l; j++ {
				dest[j] = c
			}
			dest = dest[l:]
			i += 2
		}
		buf = buf[ln:]
	}
	return nil
}
