package model

type AllowedIPRanges []AllowedIPRange

type AllowedIPRange struct {
	CIDRBlock   string
	Description string
	Enabled     bool
	OwnerID     string
}

func (air *AllowedIPRanges) Auditable() map[string]interface{} {
	return map[string]interface{}{
		"AllowedIPRanges": air,
	}
}

type GetIPAddressResponse struct {
	IP string
}
