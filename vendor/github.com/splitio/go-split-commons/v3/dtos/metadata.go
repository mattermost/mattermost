package dtos

// Metadata is used to store sdk metadata
type Metadata struct {
	SDKVersion  string `json:"s"`
	MachineIP   string `json:"i"`
	MachineName string `json:"n"`
}
