package raster

type Fix int32

const (
	FIXED_SHIFT      = 16
	FIXED_FLOAT_COEF = 1 << FIXED_SHIFT
)

/*! Fixed point math inevitably introduces rounding error to the DDA. The error is
 *  fixed every now and then by a separate fix value. The defines below set these.
 */
const (
	SLOPE_FIX_SHIFT = 8
	SLOPE_FIX_STEP  = 1 << SLOPE_FIX_SHIFT
	SLOPE_FIX_MASK  = SLOPE_FIX_STEP - 1
)
