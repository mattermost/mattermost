package client

import (
	"fmt"

	"github.com/splitio/go-split-commons/v2/dtos"
	"github.com/splitio/go-split-commons/v2/storage"
	"github.com/splitio/go-toolkit/v3/logging"
)

// SplitManager provides information of the currently stored splits
type SplitManager struct {
	splitStorage storage.SplitStorageConsumer
	validator    inputValidation
	logger       logging.LoggerInterface
	factory      *SplitFactory
}

// SplitView is a partial representation of a currently stored split
type SplitView struct {
	Name         string            `json:"name"`
	TrafficType  string            `json:"trafficType"`
	Killed       bool              `json:"killed"`
	Treatments   []string          `json:"treatments"`
	ChangeNumber int64             `json:"changeNumber"`
	Configs      map[string]string `json:"configs"`
}

func newSplitView(splitDto *dtos.SplitDTO) *SplitView {
	treatments := make([]string, 0)
	for _, condition := range splitDto.Conditions {
		for _, partition := range condition.Partitions {
			treatments = append(treatments, partition.Treatment)
		}
	}
	return &SplitView{
		ChangeNumber: splitDto.ChangeNumber,
		Killed:       splitDto.Killed,
		Name:         splitDto.Name,
		TrafficType:  splitDto.TrafficTypeName,
		Treatments:   treatments,
		Configs:      splitDto.Configurations,
	}
}

// SplitNames returns a list with the name of all the currently stored splits
func (m *SplitManager) SplitNames() []string {
	if m.isDestroyed() {
		m.logger.Error("Client has already been destroyed - no calls possible")
		return []string{}
	}

	if !m.isReady() {
		m.logger.Warning("splitNames: the SDK is not ready, results may be incorrect. Make sure to wait for SDK readiness before using this method")
	}

	return m.splitStorage.SplitNames()
}

// Splits returns a list of a partial view of every currently stored split
func (m *SplitManager) Splits() []SplitView {
	if m.isDestroyed() {
		m.logger.Error("Client has already been destroyed - no calls possible")
		return []SplitView{}
	}

	if !m.isReady() {
		m.logger.Warning("splits: the SDK is not ready, results may be incorrect. Make sure to wait for SDK readiness before using this method")
	}

	splitViews := make([]SplitView, 0)
	splits := m.splitStorage.All()
	for _, split := range splits {
		splitViews = append(splitViews, *newSplitView(&split))
	}
	return splitViews
}

// Split returns a partial view of a particular split
func (m *SplitManager) Split(feature string) *SplitView {
	if m.isDestroyed() {
		m.logger.Error("Client has already been destroyed - no calls possible")
		return nil
	}

	if !m.isReady() {
		m.logger.Warning("split: the SDK is not ready, results may be incorrect. Make sure to wait for SDK readiness before using this method")
	}

	err := m.validator.ValidateManagerInputs(feature)
	if err != nil {
		m.logger.Error(err.Error())
		return nil
	}

	split := m.splitStorage.Split(feature)
	if split != nil {
		return newSplitView(split)
	}
	m.logger.Error(fmt.Sprintf("Split: you passed %s that does not exist in this environment, please double check what Splits exist in the web console.", feature))
	return nil
}

// BlockUntilReady Calls BlockUntilReady on factory to block manager on readiness
func (m *SplitManager) BlockUntilReady(timer int) error {
	return m.factory.BlockUntilReady(timer)
}

func (m *SplitManager) isDestroyed() bool {
	return m.factory.IsDestroyed()
}

func (m *SplitManager) isReady() bool {
	return m.factory.IsReady()
}
