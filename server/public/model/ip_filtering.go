package model

type AllowedIPRanges []AllowedIPRange

type AllowedIPRange struct {
	CIDRBlock   string `json:"cidr_block"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
	OwnerID     string `json:"owner_id"`
}

func (air *AllowedIPRanges) Auditable() map[string]any {
	return map[string]any{
		"AllowedIPRanges": air,
	}
}

type GetIPAddressResponse struct {
	IP string `json:"ip"`
}
