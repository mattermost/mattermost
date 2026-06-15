// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package targets hosts custom mlog targets that the audit logger can route
// records to. Targets here are registered via audit.Audit.Factories at
// configureAudit time.
package targets

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/mattermost/logr/v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// DeliveryDBTargetType is the target-type string used in advanced-logging
// JSON to wire this target. Match in lowercase since the configurator
// passes the original string through to the factory.
const DeliveryDBTargetType = "audit_delivery_db"

// init registers a validation-time factory so LoggerConfiguration.IsValid
// recognises this custom target type. The validation target is a no-op
// (nil store) — it only exists so the type-name check during config
// validation passes. The real runtime target, with the actual store
// wired in, is constructed by app.configureAudit when the audit logger
// is configured.
func init() {
	mlog.ValidationFactories = &mlog.Factories{
		TargetFactory: func(targetType string, _ json.RawMessage) (logr.Target, error) {
			if strings.ToLower(targetType) == DeliveryDBTargetType {
				return &DeliveryDBTarget{}, nil
			}
			return nil, fmt.Errorf("unrecognized target type %q", targetType)
		},
	}
}

// DeliveryDBTarget writes audit records emitted at mlog.LvlAuditDelivery
// into the audit_storage table via the AuditStorageStore. The expected
// record shape is what app.emitDeliveryAudit produces: a model.AuditRecord
// whose Meta map carries user_id, entity_id, and mechanism keys.
//
// One Write call performs one Mark(); there is no buffering. Callers that
// produce wide fan-outs rely on the audit logger's per-target queue to
// absorb bursts.
type DeliveryDBTarget struct {
	store store.AuditStorageStore
}

// NewDeliveryDBTarget builds a target backed by the given store. The store
// reference is captured at construction; the noop fallback returned when
// AuditStorageSettings.Enable=false is still safe to use here because its
// Mark is a no-op.
func NewDeliveryDBTarget(s store.AuditStorageStore) *DeliveryDBTarget {
	return &DeliveryDBTarget{store: s}
}

func (t *DeliveryDBTarget) Init() error     { return nil }
func (t *DeliveryDBTarget) Shutdown() error { return nil }

// Write extracts the (user_id, entity_id, mechanism) triple from the
// audit record's Meta map and calls store.Mark. The formatted bytes (p)
// are ignored — we read structured field values directly so we never
// have to parse a serialized representation.
func (t *DeliveryDBTarget) Write(p []byte, rec *mlog.LogRec) (int, error) {
	for _, f := range rec.Fields() {
		if f.Key != model.AuditKeyMeta {
			continue
		}
		meta, ok := f.Interface.(map[string]any)
		if !ok {
			return 0, fmt.Errorf("audit_delivery_db: meta field is not map[string]any (got %T)", f.Interface)
		}
		userID, _ := meta["user_id"].(string)
		entityID, _ := meta["entity_id"].(string)
		mech, _ := meta["mechanism"].(int16)
		if userID == "" || entityID == "" {
			return 0, nil
		}
		if err := t.store.Mark(context.Background(), userID, entityID, mech); err != nil {
			return 0, fmt.Errorf("audit_delivery_db: mark failed: %w", err)
		}
		return len(p), nil
	}
	return 0, nil
}
