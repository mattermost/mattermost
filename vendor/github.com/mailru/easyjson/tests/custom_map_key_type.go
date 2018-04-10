package tests

import fmt "fmt"

//easyjson:json
type CustomMapKeyType struct {
	Map map[customKeyType]int
}

type customKeyType [2]byte

func (k customKeyType) MarshalJSON() ([]byte, error) {
	return []byte(fmt.Sprintf(`"%02x"`, k)), nil
}

func (k *customKeyType) UnmarshalJSON(b []byte) error {
	_, err := fmt.Sscanf(string(b), `"%02x%02x"`, &k[0], &k[1])
	return err
}

var customMapKeyTypeValue CustomMapKeyType

func init() {
	customMapKeyTypeValue.Map = map[customKeyType]int{
		customKeyType{0x01, 0x02}: 3,
	}
}

var customMapKeyTypeValueString = `{"Map":{"0102":3}}`
