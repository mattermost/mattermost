package psd

// BlendMode represents the blend mode.
type BlendMode string

// These blend modes are defined in this document.
//
// http://www.adobe.com/devnet-apps/photoshop/fileformatashtml/#50577409_13084
const (
	BlendModePassThrough  = BlendMode("pass")
	BlendModeNormal       = BlendMode("norm")
	BlendModeDissolve     = BlendMode("diss")
	BlendModeDarken       = BlendMode("dark")
	BlendModeMultiply     = BlendMode("mul ")
	BlendModeColorBurn    = BlendMode("idiv")
	BlendModeLinearBurn   = BlendMode("lbrn")
	BlendModeDarkerColor  = BlendMode("dkCl")
	BlendModeLighten      = BlendMode("lite")
	BlendModeScreen       = BlendMode("scrn")
	BlendModeColorDodge   = BlendMode("div ")
	BlendModeLinearDodge  = BlendMode("lddg")
	BlendModeLighterColor = BlendMode("lgCl")
	BlendModeOverlay      = BlendMode("over")
	BlendModeSoftLight    = BlendMode("sLit")
	BlendModeHardLight    = BlendMode("hLit")
	BlendModeVividLight   = BlendMode("vLit")
	BlendModeLinearLight  = BlendMode("lLit")
	BlendModePinLight     = BlendMode("pLit")
	BlendModeHardMix      = BlendMode("hMix")
	BlendModeDifference   = BlendMode("diff")
	BlendModeExclusion    = BlendMode("smud")
	BlendModeSubtract     = BlendMode("fsub")
	BlendModeDivide       = BlendMode("fdiv")
	BlendModeHue          = BlendMode("hue ")
	BlendModeSaturation   = BlendMode("sat ")
	BlendModeColor        = BlendMode("colr")
	BlendModeLuminosity   = BlendMode("lum ")
)

// String implements fmt.Stringer interface.
//
// The return value respects blend name that is described in "Compositing and Blending Level 1"(https://www.w3.org/TR/compositing-1/#blending).
func (bm BlendMode) String() string {
	switch bm {
	case BlendModePassThrough:
		return "pass-through"
	case BlendModeNormal:
		return "normal"
	case BlendModeDissolve:
		return "dissolve"
	case BlendModeDarken:
		return "darken"
	case BlendModeMultiply:
		return "multiply"
	case BlendModeColorBurn:
		return "color-burn"
	case BlendModeLinearBurn:
		return "linear-burn"
	case BlendModeDarkerColor:
		return "darker-color"
	case BlendModeLighten:
		return "lighten"
	case BlendModeScreen:
		return "screen"
	case BlendModeColorDodge:
		return "color-dodge"
	case BlendModeLinearDodge:
		return "linear-dodge"
	case BlendModeLighterColor:
		return "lighter-color"
	case BlendModeOverlay:
		return "overlay"
	case BlendModeSoftLight:
		return "soft-light"
	case BlendModeHardLight:
		return "hard-light"
	case BlendModeVividLight:
		return "vivid-light"
	case BlendModeLinearLight:
		return "linear-light"
	case BlendModePinLight:
		return "pin-light"
	case BlendModeHardMix:
		return "hard-mix"
	case BlendModeDifference:
		return "difference"
	case BlendModeExclusion:
		return "exclusion"
	case BlendModeSubtract:
		return "subtract"
	case BlendModeDivide:
		return "divide"
	case BlendModeHue:
		return "hue"
	case BlendModeSaturation:
		return "saturation"
	case BlendModeColor:
		return "color"
	case BlendModeLuminosity:
		return "luminosity"
	}
	return "unknown-blend-name-" + string(bm)
}
