package imaging

import (
	"image"
)

// Rotate90 rotates the image 90 degrees counterclockwise and returns the transformed image.
func Rotate90(img image.Image) *image.NRGBA {
	src := toNRGBA(img)
	srcW := src.Bounds().Max.X
	srcH := src.Bounds().Max.Y
	dstW := srcH
	dstH := srcW
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))

	parallel(dstH, func(partStart, partEnd int) {

		for dstY := partStart; dstY < partEnd; dstY++ {
			for dstX := 0; dstX < dstW; dstX++ {
				srcX := dstH - dstY - 1
				srcY := dstX

				srcOff := srcY*src.Stride + srcX*4
				dstOff := dstY*dst.Stride + dstX*4

				copy(dst.Pix[dstOff:dstOff+4], src.Pix[srcOff:srcOff+4])
			}
		}

	})

	return dst
}

// Rotate180 rotates the image 180 degrees counterclockwise and returns the transformed image.
func Rotate180(img image.Image) *image.NRGBA {
	src := toNRGBA(img)
	srcW := src.Bounds().Max.X
	srcH := src.Bounds().Max.Y
	dstW := srcW
	dstH := srcH
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))

	parallel(dstH, func(partStart, partEnd int) {

		for dstY := partStart; dstY < partEnd; dstY++ {
			for dstX := 0; dstX < dstW; dstX++ {
				srcX := dstW - dstX - 1
				srcY := dstH - dstY - 1

				srcOff := srcY*src.Stride + srcX*4
				dstOff := dstY*dst.Stride + dstX*4

				copy(dst.Pix[dstOff:dstOff+4], src.Pix[srcOff:srcOff+4])
			}
		}

	})

	return dst
}

// Rotate270 rotates the image 270 degrees counterclockwise and returns the transformed image.
func Rotate270(img image.Image) *image.NRGBA {
	src := toNRGBA(img)
	srcW := src.Bounds().Max.X
	srcH := src.Bounds().Max.Y
	dstW := srcH
	dstH := srcW
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))

	parallel(dstH, func(partStart, partEnd int) {

		for dstY := partStart; dstY < partEnd; dstY++ {
			for dstX := 0; dstX < dstW; dstX++ {
				srcX := dstY
				srcY := dstW - dstX - 1

				srcOff := srcY*src.Stride + srcX*4
				dstOff := dstY*dst.Stride + dstX*4

				copy(dst.Pix[dstOff:dstOff+4], src.Pix[srcOff:srcOff+4])
			}
		}

	})

	return dst
}

// FlipH flips the image horizontally (from left to right) and returns the transformed image.
func FlipH(img image.Image) *image.NRGBA {
	src := toNRGBA(img)
	srcW := src.Bounds().Max.X
	srcH := src.Bounds().Max.Y
	dstW := srcW
	dstH := srcH
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))

	parallel(dstH, func(partStart, partEnd int) {

		for dstY := partStart; dstY < partEnd; dstY++ {
			for dstX := 0; dstX < dstW; dstX++ {
				srcX := dstW - dstX - 1
				srcY := dstY

				srcOff := srcY*src.Stride + srcX*4
				dstOff := dstY*dst.Stride + dstX*4

				copy(dst.Pix[dstOff:dstOff+4], src.Pix[srcOff:srcOff+4])
			}
		}

	})

	return dst
}

// FlipV flips the image vertically (from top to bottom) and returns the transformed image.
func FlipV(img image.Image) *image.NRGBA {
	src := toNRGBA(img)
	srcW := src.Bounds().Max.X
	srcH := src.Bounds().Max.Y
	dstW := srcW
	dstH := srcH
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))

	parallel(dstH, func(partStart, partEnd int) {

		for dstY := partStart; dstY < partEnd; dstY++ {
			for dstX := 0; dstX < dstW; dstX++ {
				srcX := dstX
				srcY := dstH - dstY - 1

				srcOff := srcY*src.Stride + srcX*4
				dstOff := dstY*dst.Stride + dstX*4

				copy(dst.Pix[dstOff:dstOff+4], src.Pix[srcOff:srcOff+4])
			}
		}

	})

	return dst
}

// Transpose flips the image horizontally and rotates 90 degrees counter-clockwise.
func Transpose(img image.Image) *image.NRGBA {
	src := toNRGBA(img)
	srcW := src.Bounds().Max.X
	srcH := src.Bounds().Max.Y
	dstW := srcH
	dstH := srcW
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))

	parallel(dstH, func(partStart, partEnd int) {

		for dstY := partStart; dstY < partEnd; dstY++ {
			for dstX := 0; dstX < dstW; dstX++ {
				srcX := dstY
				srcY := dstX

				srcOff := srcY*src.Stride + srcX*4
				dstOff := dstY*dst.Stride + dstX*4

				copy(dst.Pix[dstOff:dstOff+4], src.Pix[srcOff:srcOff+4])
			}
		}

	})

	return dst
}

// Transverse flips the image vertically and rotates 90 degrees counter-clockwise.
func Transverse(img image.Image) *image.NRGBA {
	src := toNRGBA(img)
	srcW := src.Bounds().Max.X
	srcH := src.Bounds().Max.Y
	dstW := srcH
	dstH := srcW
	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))

	parallel(dstH, func(partStart, partEnd int) {

		for dstY := partStart; dstY < partEnd; dstY++ {
			for dstX := 0; dstX < dstW; dstX++ {
				srcX := dstH - dstY - 1
				srcY := dstW - dstX - 1

				srcOff := srcY*src.Stride + srcX*4
				dstOff := dstY*dst.Stride + dstX*4

				copy(dst.Pix[dstOff:dstOff+4], src.Pix[srcOff:srcOff+4])
			}
		}

	})

	return dst
}
