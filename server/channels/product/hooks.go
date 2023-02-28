// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package product

import (
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/v6/channels/einterfaces"
	"github.com/mattermost/mattermost-server/v6/plugin"
)

type HooksManager struct {
	registeredProducts sync.Map
	metrics            einterfaces.MetricsInterface
}

func NewHooksManager(metrics einterfaces.MetricsInterface) *HooksManager {
	return &HooksManager{
		metrics: metrics,
	}
}

func (m *HooksManager) AddProduct(productID string, hooks any) error {
	prod, err := plugin.NewAdapter(hooks)
	if err != nil {
		return err
	}

	rp := &plugin.RegisteredProduct{
		ProductID: productID,
		Adapter:   prod,
	}

	m.registeredProducts.Store(productID, rp)

	return nil
}

func (m *HooksManager) RemoveProduct(productID string) {
	m.registeredProducts.Delete(productID)
}

func (m *HooksManager) RunMultiHook(hookRunnerFunc func(hooks plugin.Hooks) bool, hookId int) {
	startTime := time.Now()

	m.registeredProducts.Range(func(key, value any) bool {
		rp := value.(*plugin.RegisteredProduct)

		if !rp.Implements(hookId) {
			return true
		}

		hookStartTime := time.Now()
		result := hookRunnerFunc(rp.Adapter)

		if m.metrics != nil {
			elapsedTime := float64(time.Since(hookStartTime)) / float64(time.Second)
			m.metrics.ObservePluginMultiHookIterationDuration(rp.ProductID, elapsedTime)
		}

		return result
	})

	if m.metrics != nil {
		elapsedTime := float64(time.Since(startTime)) / float64(time.Second)
		m.metrics.ObservePluginMultiHookDuration(elapsedTime)
	}
}

func (m *HooksManager) HooksForProduct(id string) plugin.Hooks {
	if value, ok := m.registeredProducts.Load(id); ok {
		rp := value.(*plugin.RegisteredProduct)
		return rp.Adapter
	}

	return nil
}
