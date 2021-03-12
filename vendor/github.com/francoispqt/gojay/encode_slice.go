package gojay

// AddSliceString marshals the given []string s
func (enc *Encoder) AddSliceString(s []string) {
	enc.SliceString(s)
}

// SliceString marshals the given []string s
func (enc *Encoder) SliceString(s []string) {
	enc.Array(EncodeArrayFunc(func(enc *Encoder) {
		for _, str := range s {
			enc.String(str)
		}
	}))
}

// AddSliceStringKey marshals the given []string s
func (enc *Encoder) AddSliceStringKey(k string, s []string) {
	enc.SliceStringKey(k, s)
}

// SliceStringKey marshals the given []string s
func (enc *Encoder) SliceStringKey(k string, s []string) {
	enc.ArrayKey(k, EncodeArrayFunc(func(enc *Encoder) {
		for _, str := range s {
			enc.String(str)
		}
	}))
}

// AddSliceInt marshals the given []int s
func (enc *Encoder) AddSliceInt(s []int) {
	enc.SliceInt(s)
}

// SliceInt marshals the given []int s
func (enc *Encoder) SliceInt(s []int) {
	enc.Array(EncodeArrayFunc(func(enc *Encoder) {
		for _, i := range s {
			enc.Int(i)
		}
	}))
}

// AddSliceIntKey marshals the given []int s
func (enc *Encoder) AddSliceIntKey(k string, s []int) {
	enc.SliceIntKey(k, s)
}

// SliceIntKey marshals the given []int s
func (enc *Encoder) SliceIntKey(k string, s []int) {
	enc.ArrayKey(k, EncodeArrayFunc(func(enc *Encoder) {
		for _, i := range s {
			enc.Int(i)
		}
	}))
}

// AddSliceFloat64 marshals the given []float64 s
func (enc *Encoder) AddSliceFloat64(s []float64) {
	enc.SliceFloat64(s)
}

// SliceFloat64 marshals the given []float64 s
func (enc *Encoder) SliceFloat64(s []float64) {
	enc.Array(EncodeArrayFunc(func(enc *Encoder) {
		for _, i := range s {
			enc.Float64(i)
		}
	}))
}

// AddSliceFloat64Key marshals the given []float64 s
func (enc *Encoder) AddSliceFloat64Key(k string, s []float64) {
	enc.SliceFloat64Key(k, s)
}

// SliceFloat64Key marshals the given []float64 s
func (enc *Encoder) SliceFloat64Key(k string, s []float64) {
	enc.ArrayKey(k, EncodeArrayFunc(func(enc *Encoder) {
		for _, i := range s {
			enc.Float64(i)
		}
	}))
}

// AddSliceBool marshals the given []bool s
func (enc *Encoder) AddSliceBool(s []bool) {
	enc.SliceBool(s)
}

// SliceBool marshals the given []bool s
func (enc *Encoder) SliceBool(s []bool) {
	enc.Array(EncodeArrayFunc(func(enc *Encoder) {
		for _, i := range s {
			enc.Bool(i)
		}
	}))
}

// AddSliceBoolKey marshals the given []bool s
func (enc *Encoder) AddSliceBoolKey(k string, s []bool) {
	enc.SliceBoolKey(k, s)
}

// SliceBoolKey marshals the given []bool s
func (enc *Encoder) SliceBoolKey(k string, s []bool) {
	enc.ArrayKey(k, EncodeArrayFunc(func(enc *Encoder) {
		for _, i := range s {
			enc.Bool(i)
		}
	}))
}
