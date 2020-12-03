package gojay

// AddSliceString unmarshals the next JSON array of strings to the given *[]string s
func (dec *Decoder) AddSliceString(s *[]string) error {
	return dec.SliceString(s)
}

// SliceString unmarshals the next JSON array of strings to the given *[]string s
func (dec *Decoder) SliceString(s *[]string) error {
	err := dec.Array(DecodeArrayFunc(func(dec *Decoder) error {
		var str string
		if err := dec.String(&str); err != nil {
			return err
		}
		*s = append(*s, str)
		return nil
	}))

	if err != nil {
		return err
	}
	return nil
}

// AddSliceInt unmarshals the next JSON array of integers to the given *[]int s
func (dec *Decoder) AddSliceInt(s *[]int) error {
	return dec.SliceInt(s)
}

// SliceInt unmarshals the next JSON array of integers to the given *[]int s
func (dec *Decoder) SliceInt(s *[]int) error {
	err := dec.Array(DecodeArrayFunc(func(dec *Decoder) error {
		var i int
		if err := dec.Int(&i); err != nil {
			return err
		}
		*s = append(*s, i)
		return nil
	}))

	if err != nil {
		return err
	}
	return nil
}

// AddFloat64 unmarshals the next JSON array of floats to the given *[]float64 s
func (dec *Decoder) AddSliceFloat64(s *[]float64) error {
	return dec.SliceFloat64(s)
}

// SliceFloat64 unmarshals the next JSON array of floats to the given *[]float64 s
func (dec *Decoder) SliceFloat64(s *[]float64) error {
	err := dec.Array(DecodeArrayFunc(func(dec *Decoder) error {
		var i float64
		if err := dec.Float64(&i); err != nil {
			return err
		}
		*s = append(*s, i)
		return nil
	}))

	if err != nil {
		return err
	}
	return nil
}

// AddBool unmarshals the next JSON array of boolegers to the given *[]bool s
func (dec *Decoder) AddSliceBool(s *[]bool) error {
	return dec.SliceBool(s)
}

// SliceBool unmarshals the next JSON array of boolegers to the given *[]bool s
func (dec *Decoder) SliceBool(s *[]bool) error {
	err := dec.Array(DecodeArrayFunc(func(dec *Decoder) error {
		var b bool
		if err := dec.Bool(&b); err != nil {
			return err
		}
		*s = append(*s, b)
		return nil
	}))

	if err != nil {
		return err
	}
	return nil
}
