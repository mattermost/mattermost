package genderize

// GenderType is an enum for storing gender returned from the API, allows for easy and quick comparisons
type GenderType int8

// These consts hold the gender returned from the API
const (
	Unknown GenderType = iota
	Male
	Female
)

// String method will return the string version of a gender returned from the API
func (g GenderType) String() string {
	switch g {
	case Male:
		return "male"
	case Female:
		return "female"
	default:
		return "unknown"
	}
}

// XRateHeaders contains the values in the X-Rate headers that hold information about rate limits
type XRateHeaders struct {
	Limit     int
	Remaining int
	Reset     int
}

// Result contains the results for each name sent to the API
type Result struct {
	Name        string
	Gender      GenderType
	Probability float64
	Count       int
	RateLimit   XRateHeaders
}

type responseSingle struct {
	Name        string  `json:"name"`
	Gender      string  `json:"gender"`
	Probability float64 `json:"probability"`
	Count       int     `json:"count"`
}

type responseMulti []struct {
	Name        string  `json:"name"`
	Gender      string  `json:"gender"`
	Probability float64 `json:"probability"`
	Count       int     `json:"count"`
}
