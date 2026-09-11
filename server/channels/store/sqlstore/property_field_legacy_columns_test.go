package sqlstore

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestPropertyFieldLegacyColumnDualWrite(t *testing.T) {
	logger := mlog.CreateTestLogger(t)

	settings, err := makeSqlSettings(model.DatabaseDriverPostgres)
	if err != nil {
		t.Skip(err)
	}

	store, err := New(*settings, logger, nil)
	require.NoError(t, err)
	defer store.Close()

	type legacyCols struct {
		Protected         bool           `db:"protected"`
		PermissionField   sql.NullString `db:"permissionfield"`
		PermissionValues  sql.NullString `db:"permissionvalues"`
		PermissionOptions sql.NullString `db:"permissionoptions"`
	}

	verifyCols := func(t *testing.T, fieldID string, expected legacyCols) {
		t.Helper()
		var actual legacyCols
		require.NoError(t, store.GetMaster().Get(&actual,
			"SELECT Protected, PermissionField, PermissionValues, PermissionOptions FROM PropertyFields WHERE ID = $1", fieldID))

		assert.Equal(t, expected.Protected, actual.Protected)
		assert.Equal(t, expected.PermissionField.String, actual.PermissionField.String)
		assert.Equal(t, expected.PermissionValues.String, actual.PermissionValues.String)
		assert.Equal(t, expected.PermissionOptions.String, actual.PermissionOptions.String)
	}

	t.Run("should store projected values from Permissions object", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    model.NewId(),
			Name:       "Projected Permissions",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field:  model.WriteOnly{Write: model.PermissionLevelAdmin},
					Value:  model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelMember},
					Option: model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelSysadmin},
				},
			},
		}

		created, err := store.PropertyField().Create(field)
		require.NoError(t, err)

		verifyCols(t, created.ID, legacyCols{
			Protected:         false,
			PermissionField:   sql.NullString{String: "admin", Valid: true},
			PermissionValues:  sql.NullString{String: "member", Valid: true},
			PermissionOptions: sql.NullString{String: "sysadmin", Valid: true},
		})
	})

	t.Run("should store submitted legacy columns when Permissions is nil", func(t *testing.T) {
		admin := model.PermissionLevelAdmin
		member := model.PermissionLevelMember
		sysadmin := model.PermissionLevelSysadmin

		field := &model.PropertyField{
			GroupID:           model.NewId(),
			Name:              "Submitted Legacy",
			Type:              model.PropertyFieldTypeText,
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			PermissionField:   &admin,
			PermissionValues:  &member,
			PermissionOptions: &sysadmin,
			Protected:         false,
		}

		created, err := store.PropertyField().Create(field)
		require.NoError(t, err)

		verifyCols(t, created.ID, legacyCols{
			Protected:         false,
			PermissionField:   sql.NullString{String: "admin", Valid: true},
			PermissionValues:  sql.NullString{String: "member", Valid: true},
			PermissionOptions: sql.NullString{String: "sysadmin", Valid: true},
		})
	})

	t.Run("should store Protected true when field.write is none", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    model.NewId(),
			Name:       "Protected Field",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field:  model.WriteOnly{Write: model.PermissionLevelNone},
					Value:  model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelEveryone},
					Option: model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelEveryone},
				},
			},
		}

		created, err := store.PropertyField().Create(field)
		require.NoError(t, err)

		verifyCols(t, created.ID, legacyCols{
			Protected:         true,
			PermissionField:   sql.NullString{String: "none", Valid: true},
			PermissionValues:  sql.NullString{String: "everyone", Valid: true},
			PermissionOptions: sql.NullString{String: "everyone", Valid: true},
		})
	})

	t.Run("should store PermissionValues everyone when value.write is everyone", func(t *testing.T) {
		field := &model.PropertyField{
			GroupID:    model.NewId(),
			Name:       "Everyone Value Write",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{
				Restrictions: &model.Restrictions{
					Field:  model.WriteOnly{Write: model.PermissionLevelAdmin},
					Value:  model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelEveryone},
					Option: model.ReadWrite{Read: model.PermissionLevelEveryone, Write: model.PermissionLevelAdmin},
				},
			},
		}

		created, err := store.PropertyField().Create(field)
		require.NoError(t, err)

		verifyCols(t, created.ID, legacyCols{
			Protected:         false,
			PermissionField:   sql.NullString{String: "admin", Valid: true},
			PermissionValues:  sql.NullString{String: "everyone", Valid: true},
			PermissionOptions: sql.NullString{String: "admin", Valid: true},
		})
	})
}
