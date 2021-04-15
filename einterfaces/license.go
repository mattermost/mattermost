package einterfaces

type LicenseInterface interface {
	CanStartTrial() (bool, error)
}
