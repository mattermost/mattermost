package model

type AllowedIPRanges []AllowedIPRange

type AllowedIPRange struct {
	CIDRBlock   string `json:"cidr_block"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
	OwnerID     string `json:"owner_id"`
}

func (air *AllowedIPRanges) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"AllowedIPRanges": air,
	}
}

type GetIPAddressResponse struct {
	IP string `json:"ip"`
}
