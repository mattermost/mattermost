// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

// ---------- Helpers ----------

func mustMarshal(t *testing.T, v any) json.RawMessage {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return b
}

func selectField(name, optID, optName string) *model.PropertyField {
	return &model.PropertyField{
		ID:   model.NewId(),
		Name: name,
		Type: model.PropertyFieldTypeSelect,
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"id": optID, "name": optName},
			},
		},
	}
}

func multiselectField(name string, opts map[string]string) *model.PropertyField {
	options := make([]any, 0, len(opts))
	for id, n := range opts {
		options = append(options, map[string]any{"id": id, "name": n})
	}
	return &model.PropertyField{
		ID:   model.NewId(),
		Name: name,
		Type: model.PropertyFieldTypeMultiselect,
		Attrs: model.StringInterface{
			model.PropertyFieldAttributeOptions: options,
		},
	}
}

func textField(name string) *model.PropertyField {
	return &model.PropertyField{ID: model.NewId(), Name: name, Type: model.PropertyFieldTypeText}
}

func dateField(name string) *model.PropertyField {
	return &model.PropertyField{ID: model.NewId(), Name: name, Type: model.PropertyFieldTypeDate}
}

func userField(name string) *model.PropertyField {
	return &model.PropertyField{ID: model.NewId(), Name: name, Type: model.PropertyFieldTypeUser}
}

func multiuserField(name string) *model.PropertyField {
	return &model.PropertyField{ID: model.NewId(), Name: name, Type: model.PropertyFieldTypeMultiuser}
}

// ---------- renderPropertyValueAsText ----------

func TestRenderPropertyValueAsText_Text(t *testing.T) {
	f := textField("Title")
	v := &model.PropertyValue{FieldID: f.ID, Value: mustMarshal(t, "hello world")}

	got, ok := renderPropertyValueAsText(v, f, nil, model.ShowUsername)
	require.True(t, ok)
	require.Equal(t, "hello world", got)
}

func TestRenderPropertyValueAsText_Text_MalformedJSON(t *testing.T) {
	f := textField("Title")
	// raw integer is not a string — strict JSON unmarshal must fail.
	v := &model.PropertyValue{FieldID: f.ID, Value: json.RawMessage("12345")}

	_, ok := renderPropertyValueAsText(v, f, nil, model.ShowUsername)
	require.False(t, ok, "malformed text value must omit the key")
}

func TestRenderPropertyValueAsText_Date(t *testing.T) {
	f := dateField("Due")
	v := &model.PropertyValue{FieldID: f.ID, Value: mustMarshal(t, "2026-06-05T10:00:00Z")}

	got, ok := renderPropertyValueAsText(v, f, nil, model.ShowUsername)
	require.True(t, ok)
	require.Equal(t, "2026-06-05T10:00:00Z", got)
}

func TestRenderPropertyValueAsText_Select_Known(t *testing.T) {
	f := selectField("Priority", "opt1", "High")
	v := &model.PropertyValue{FieldID: f.ID, Value: mustMarshal(t, "opt1")}

	got, ok := renderPropertyValueAsText(v, f, nil, model.ShowUsername)
	require.True(t, ok)
	require.Equal(t, "High", got)
}

func TestRenderPropertyValueAsText_Select_UnknownOption(t *testing.T) {
	f := selectField("Priority", "opt1", "High")
	v := &model.PropertyValue{FieldID: f.ID, Value: mustMarshal(t, "opt99")}

	got, ok := renderPropertyValueAsText(v, f, nil, model.ShowUsername)
	require.True(t, ok)
	require.Equal(t, "(unknown option)", got)
}

func TestRenderPropertyValueAsText_Select_EmptyValue(t *testing.T) {
	f := selectField("Priority", "opt1", "High")
	v := &model.PropertyValue{FieldID: f.ID, Value: mustMarshal(t, "")}

	_, ok := renderPropertyValueAsText(v, f, nil, model.ShowUsername)
	require.False(t, ok, "empty select id must omit the key")
}

func TestRenderPropertyValueAsText_Multiselect_OrderPreservedAndUnknown(t *testing.T) {
	f := multiselectField("Tags", map[string]string{
		"o1": "alpha",
		"o2": "beta",
	})
	v := &model.PropertyValue{
		FieldID: f.ID,
		// Stored order: o2, o1, o-missing — assert output order matches.
		Value: mustMarshal(t, []string{"o2", "o1", "o-missing"}),
	}

	got, ok := renderPropertyValueAsText(v, f, nil, model.ShowUsername)
	require.True(t, ok)
	require.Equal(t, "beta, alpha, (unknown option)", got)
}

func TestRenderPropertyValueAsText_Multiselect_EmptyList(t *testing.T) {
	f := multiselectField("Tags", map[string]string{"o1": "alpha"})
	v := &model.PropertyValue{FieldID: f.ID, Value: mustMarshal(t, []string{})}

	got, ok := renderPropertyValueAsText(v, f, nil, model.ShowUsername)
	require.True(t, ok)
	require.Equal(t, "", got, "empty multiselect list still renders an empty string (key kept)")
}

func TestRenderPropertyValueAsText_User_FoundDisplayName(t *testing.T) {
	f := userField("Owner")
	uid := model.NewId()
	v := &model.PropertyValue{FieldID: f.ID, Value: mustMarshal(t, uid)}
	users := map[string]*model.User{
		uid: {Id: uid, Username: "msmith", FirstName: "Miguel", LastName: "Smith"},
	}

	got, ok := renderPropertyValueAsText(v, f, users, model.ShowFullName)
	require.True(t, ok)
	require.Equal(t, "Miguel Smith", got)
}

func TestRenderPropertyValueAsText_User_FallsBackToUsername(t *testing.T) {
	f := userField("Owner")
	uid := model.NewId()
	v := &model.PropertyValue{FieldID: f.ID, Value: mustMarshal(t, uid)}
	users := map[string]*model.User{
		// No first/last set; ShowFullName -> empty display name -> username fallback.
		uid: {Id: uid, Username: "msmith"},
	}

	got, ok := renderPropertyValueAsText(v, f, users, model.ShowFullName)
	require.True(t, ok)
	require.Equal(t, "msmith", got)
}

func TestRenderPropertyValueAsText_User_Unknown(t *testing.T) {
	f := userField("Owner")
	v := &model.PropertyValue{FieldID: f.ID, Value: mustMarshal(t, model.NewId())}

	got, ok := renderPropertyValueAsText(v, f, map[string]*model.User{}, model.ShowUsername)
	require.True(t, ok)
	require.Equal(t, "(unknown user)", got)
}

func TestRenderPropertyValueAsText_Multiuser_OrderPreservedAndUnknown(t *testing.T) {
	f := multiuserField("Watchers")
	u1, u2, u3 := model.NewId(), model.NewId(), model.NewId()
	users := map[string]*model.User{
		u1: {Id: u1, Username: "alice"},
		u2: {Id: u2, Username: "bob"},
		// u3 intentionally missing
	}
	v := &model.PropertyValue{FieldID: f.ID, Value: mustMarshal(t, []string{u2, u3, u1})}

	got, ok := renderPropertyValueAsText(v, f, users, model.ShowUsername)
	require.True(t, ok)
	require.Equal(t, "bob, (unknown user), alice", got)
}

func TestRenderPropertyValueAsText_Multiuser_EmptyList(t *testing.T) {
	f := multiuserField("Watchers")
	v := &model.PropertyValue{FieldID: f.ID, Value: mustMarshal(t, []string{})}

	got, ok := renderPropertyValueAsText(v, f, nil, model.ShowUsername)
	require.True(t, ok)
	require.Equal(t, "", got)
}

func TestRenderPropertyValueAsText_UnknownFieldType_StringFallback(t *testing.T) {
	// A hypothetical future field type should not panic; if the value is a JSON
	// string we pass it through. Anything else is omitted.
	f := &model.PropertyField{ID: model.NewId(), Name: "Future", Type: "url"}
	v := &model.PropertyValue{FieldID: f.ID, Value: mustMarshal(t, "https://example.com")}

	got, ok := renderPropertyValueAsText(v, f, nil, model.ShowUsername)
	require.True(t, ok)
	require.Equal(t, "https://example.com", got)
}

func TestRenderPropertyValueAsText_UnknownFieldType_NonStringOmitted(t *testing.T) {
	f := &model.PropertyField{ID: model.NewId(), Name: "Future", Type: "url"}
	v := &model.PropertyValue{FieldID: f.ID, Value: json.RawMessage(`{"complex":"object"}`)}

	_, ok := renderPropertyValueAsText(v, f, nil, model.ShowUsername)
	require.False(t, ok)
}

// ---------- optionNameByID ----------

func TestOptionNameByID_NoAttrs(t *testing.T) {
	f := &model.PropertyField{Type: model.PropertyFieldTypeSelect}
	_, ok := optionNameByID(f, "x")
	require.False(t, ok)
}

func TestOptionNameByID_NoOptionsKey(t *testing.T) {
	f := &model.PropertyField{Type: model.PropertyFieldTypeSelect, Attrs: model.StringInterface{"other": 1}}
	_, ok := optionNameByID(f, "x")
	require.False(t, ok)
}

// ---------- embedPostPropertiesForSync ----------

// scsWithMocks builds a Service backed by mocks that satisfy GetStore, Config,
// Log, and GetMetrics. The returned mock store is wired into the server mock.
func scsWithMocks(t *testing.T) (*Service, *MockServerIface, *mocks.Store) {
	t.Helper()
	mockServer := &MockServerIface{}
	logger := mlog.CreateConsoleTestLogger(t)
	mockServer.On("Log").Return(logger).Maybe()

	cfg := model.Config{}
	cfg.SetDefaults()
	mockServer.On("Config").Return(&cfg).Maybe()
	mockServer.On("GetMetrics").Return(nil).Maybe()

	mockStore := &mocks.Store{}
	mockServer.On("GetStore").Return(mockStore).Maybe()

	scs := &Service{server: mockServer, app: &MockAppIface{}}
	return scs, mockServer, mockStore
}

// stubPropertyStores attaches mock PropertyGroup/Field/Value stores returning
// the supplied data. Returns the individual store mocks so per-test On() calls
// can extend them.
func stubPropertyStores(
	mockStore *mocks.Store,
	group *model.PropertyGroup,
	fields []*model.PropertyField,
	values []*model.PropertyValue,
) (*mocks.PropertyGroupStore, *mocks.PropertyFieldStore, *mocks.PropertyValueStore) {
	pg := &mocks.PropertyGroupStore{}
	pf := &mocks.PropertyFieldStore{}
	pv := &mocks.PropertyValueStore{}

	mockStore.On("PropertyGroup").Return(pg).Maybe()
	mockStore.On("PropertyField").Return(pf).Maybe()
	mockStore.On("PropertyValue").Return(pv).Maybe()

	if group != nil {
		pg.On("Get", model.ChannelPostPropertyGroupName).Return(group, nil).Maybe()
	}
	pv.On("SearchPropertyValues", mock.AnythingOfType("model.PropertyValueSearchOpts")).Return(values, nil).Maybe()
	pf.On("GetMany", mock.Anything, mock.AnythingOfType("string"), mock.AnythingOfType("[]string")).Return(fields, nil).Maybe()
	return pg, pf, pv
}

func newSyncDataForPosts(posts ...*model.Post) *syncData {
	return &syncData{
		rc:    &model.RemoteCluster{RemoteId: model.NewId()},
		scr:   &model.SharedChannelRemote{Id: model.NewId()},
		posts: posts,
		task:  syncTask{channelID: model.NewId()},
	}
}

func TestEmbedPostPropertiesForSync_NoPosts_NoOp(t *testing.T) {
	scs, _, _ := scsWithMocks(t)
	sd := newSyncDataForPosts()

	err := scs.embedPostPropertiesForSync(sd)
	require.NoError(t, err)
	require.Empty(t, sd.posts)
}

func TestEmbedPostPropertiesForSync_NoGroup_SkipsCleanly(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)

	pg := &mocks.PropertyGroupStore{}
	mockStore.On("PropertyGroup").Return(pg)
	pg.On("Get", model.ChannelPostPropertyGroupName).Return(nil, assert.AnError)

	p := &model.Post{Id: model.NewId()}
	sd := newSyncDataForPosts(p)

	err := scs.embedPostPropertiesForSync(sd)
	require.NoError(t, err, "missing group must be a soft skip, not an error")
	require.Nil(t, p.Props, "no group -> Props untouched")
}

func TestEmbedPostPropertiesForSync_NoValues_PropsUntouched(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)

	group := &model.PropertyGroup{ID: model.NewId(), Name: model.ChannelPostPropertyGroupName}
	stubPropertyStores(mockStore, group, nil, nil)

	p := &model.Post{Id: model.NewId()}
	sd := newSyncDataForPosts(p)

	err := scs.embedPostPropertiesForSync(sd)
	require.NoError(t, err)
	require.Nil(t, p.Props, "no values -> Props untouched")
}

func TestEmbedPostPropertiesForSync_OnePostOneValue_WritesKey(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)

	group := &model.PropertyGroup{ID: model.NewId(), Name: model.ChannelPostPropertyGroupName}
	f := textField("Title")
	p := &model.Post{Id: model.NewId()}
	v := &model.PropertyValue{
		FieldID:  f.ID,
		TargetID: p.Id,
		Value:    mustMarshal(t, "shipped"),
	}
	stubPropertyStores(mockStore, group, []*model.PropertyField{f}, []*model.PropertyValue{v})

	sd := newSyncDataForPosts(p)
	require.NoError(t, scs.embedPostPropertiesForSync(sd))
	require.NotNil(t, p.Props)
	require.Equal(t, "shipped", p.Props["Title"])
}

func TestEmbedPostPropertiesForSync_MultiTypeOnSamePost(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)
	group := &model.PropertyGroup{ID: model.NewId(), Name: model.ChannelPostPropertyGroupName}

	fText := textField("Title")
	fSel := selectField("Priority", "p1", "High")
	p := &model.Post{Id: model.NewId()}
	vText := &model.PropertyValue{FieldID: fText.ID, TargetID: p.Id, Value: mustMarshal(t, "shipped")}
	vSel := &model.PropertyValue{FieldID: fSel.ID, TargetID: p.Id, Value: mustMarshal(t, "p1")}
	stubPropertyStores(mockStore, group, []*model.PropertyField{fText, fSel}, []*model.PropertyValue{vText, vSel})

	sd := newSyncDataForPosts(p)
	require.NoError(t, scs.embedPostPropertiesForSync(sd))
	require.Equal(t, "shipped", p.Props["Title"])
	require.Equal(t, "High", p.Props["Priority"])
}

func TestEmbedPostPropertiesForSync_CrossPostContamination(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)
	group := &model.PropertyGroup{ID: model.NewId(), Name: model.ChannelPostPropertyGroupName}

	f := textField("Title")
	p1 := &model.Post{Id: model.NewId()}
	p2 := &model.Post{Id: model.NewId()}
	v1 := &model.PropertyValue{FieldID: f.ID, TargetID: p1.Id, Value: mustMarshal(t, "v1")}
	v2 := &model.PropertyValue{FieldID: f.ID, TargetID: p2.Id, Value: mustMarshal(t, "v2")}
	stubPropertyStores(mockStore, group, []*model.PropertyField{f}, []*model.PropertyValue{v1, v2})

	sd := newSyncDataForPosts(p1, p2)
	require.NoError(t, scs.embedPostPropertiesForSync(sd))
	require.Equal(t, "v1", p1.Props["Title"])
	require.Equal(t, "v2", p2.Props["Title"])
	require.NotEqual(t, p1.Props["Title"], p2.Props["Title"], "values must not bleed across posts")
}

func TestEmbedPostPropertiesForSync_MissingFieldOmittedSiblingKept(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)
	group := &model.PropertyGroup{ID: model.NewId(), Name: model.ChannelPostPropertyGroupName}

	fKept := textField("Kept")
	p := &model.Post{Id: model.NewId()}
	vKept := &model.PropertyValue{FieldID: fKept.ID, TargetID: p.Id, Value: mustMarshal(t, "ok")}
	// A value whose field is not returned by GetMany — must be silently omitted.
	vOrphan := &model.PropertyValue{FieldID: model.NewId(), TargetID: p.Id, Value: mustMarshal(t, "lost")}
	stubPropertyStores(mockStore, group, []*model.PropertyField{fKept}, []*model.PropertyValue{vKept, vOrphan})

	sd := newSyncDataForPosts(p)
	require.NoError(t, scs.embedPostPropertiesForSync(sd))
	require.Equal(t, "ok", p.Props["Kept"], "value with present field must be embedded")
	require.NotContains(t, p.Props, "Lost", "value with missing field must be silently omitted")
	require.Len(t, p.Props, 1, "exactly one key written")
}

// TestEmbedPostPropertiesForSync_PerPagePositive guards against the regression
// where embedPostPropertiesForSync called SearchPropertyValues with PerPage<=0,
// which the SQL store rejects with "per page must be positive integer greater
// than zero". When that happened, every syncForRemote cycle aborted and nothing
// was synced (posts, users, anything).
func TestEmbedPostPropertiesForSync_PerPagePositive(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)
	group := &model.PropertyGroup{ID: model.NewId(), Name: model.ChannelPostPropertyGroupName}

	pg := &mocks.PropertyGroupStore{}
	pf := &mocks.PropertyFieldStore{}
	pv := &mocks.PropertyValueStore{}
	mockStore.On("PropertyGroup").Return(pg)
	mockStore.On("PropertyField").Return(pf)
	mockStore.On("PropertyValue").Return(pv)
	pg.On("Get", model.ChannelPostPropertyGroupName).Return(group, nil)
	pf.On("GetMany", mock.Anything, mock.Anything, mock.Anything).Return([]*model.PropertyField{}, nil).Maybe()

	var capturedOpts model.PropertyValueSearchOpts
	pv.On("SearchPropertyValues", mock.AnythingOfType("model.PropertyValueSearchOpts")).
		Run(func(args mock.Arguments) {
			capturedOpts = args.Get(0).(model.PropertyValueSearchOpts)
		}).
		Return([]*model.PropertyValue{}, nil)

	p := &model.Post{Id: model.NewId()}
	sd := newSyncDataForPosts(p)
	require.NoError(t, scs.embedPostPropertiesForSync(sd))
	require.Greater(t, capturedOpts.PerPage, 0,
		"PerPage must be strictly positive: SqlPropertyValueStore rejects PerPage<1 with an error that previously aborted every sync cycle")
}

func TestEmbedPostPropertiesForSync_PreservesExistingPropsKeys(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)
	group := &model.PropertyGroup{ID: model.NewId(), Name: model.ChannelPostPropertyGroupName}

	f := textField("Title")
	p := &model.Post{Id: model.NewId(), Props: model.StringInterface{"existing": "untouched"}}
	v := &model.PropertyValue{FieldID: f.ID, TargetID: p.Id, Value: mustMarshal(t, "shipped")}
	stubPropertyStores(mockStore, group, []*model.PropertyField{f}, []*model.PropertyValue{v})

	sd := newSyncDataForPosts(p)
	require.NoError(t, scs.embedPostPropertiesForSync(sd))
	require.Equal(t, "untouched", p.Props["existing"], "pre-existing Post.Props keys must be preserved")
	require.Equal(t, "shipped", p.Props["Title"])
}
