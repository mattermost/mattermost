package app

import (
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/plugin"
	"github.com/mattermost/mattermost-server/v6/utils"
	"github.com/pkg/errors"
)

// GetPluginIdForCollectionType identifies the plugin that registered the given collection type.
func (a *App) GetPluginIdForCollectionType(collectionType string) (string, error) {
	for pluginId, collectionTypes := range a.Channels().collectionTypes {
		// TODO: We should probably model the underlying structures differently and avoid
		// the `StringInSlice` altogether if this is the primary access pattern.
		if utils.StringInSlice(collectionType, collectionTypes) {
			return pluginId, nil
		}
	}

	return "", errors.Errorf("no plugin has registered collection type %s", collectionType)
}

// GetPluginIdForTOpicType identifies the plugin that registered the given topic type.
func (a *App) GetPluginIdForTopicType(topicType string) (string, error) {
	for collectionType, topicTypes := range a.Channels().topicTypes {
		// TODO: We should probably model the underlying structures differently and avoid
		// the `StringInSlice` altogether if this is the primary access pattern.
		if utils.StringInSlice(topicType, topicTypes) {
			for pluginId, collectionTypes := range a.Channels().collectionTypes {
				if utils.StringInSlice(collectionType, collectionTypes) {
					return pluginId, nil
				}
			}

			return "", errors.Errorf("failed to find plugin with collection owning topic type %s", topicType)
		}
	}

	return "", errors.Errorf("no plugin has registered topic type %s", topicType)
}

// GetUserIdForTopicType identifies the user id to assign to the root post when materializing
// non-channel threads. Typically, this is a bot user created by the plugin in question.
//
// TODO: Should the plugin provide this information as part of registration, avoiding the
// hard-coded lookup by username, as well as theoretically allowing this to vary by topics?
func (a *App) GetUserIdForTopicType(topicType string) (string, error) {
	pluginId, err := a.GetPluginIdForTopicType(topicType)
	if err != nil {
		return "", errors.Wrap(err, "failed to get GetUserIdForTopicType")
	}

	switch pluginId {
	case "playbooks":
		user, appErr := a.GetUserByUsername("playbooks")
		if appErr != nil {
			return "", errors.Wrap(appErr, "failed to GetUserIdForTopicType")
		}

		return user.Id, nil

	default:
		return "", errors.Errorf("no registered user for topic type %s (registered by %s)", topicType, pluginId)
	}
}

// PluginGivesUserPermissionToCollection asks the plugin that registered the given collection type
// if the user has the given permission for the collection in question.
func (a *App) PluginGivesUserPermissionToCollection(userID, collectionType, collectionID string, permission *model.Permission) (bool, error) {
	pluginsEnvironment := a.Channels().GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return false, nil
	}

	pluginId, err := a.GetPluginIdForCollectionType(collectionType)
	if err != nil {
		return false, nil
	}

	var hasPermission bool
	err = pluginsEnvironment.RunPluginHook(pluginId, func(hooks plugin.Hooks) error {
		var hookHasPermission bool
		hookHasPermission, err = hooks.UserHasPermissionToCollection(&plugin.Context{}, userID, collectionType, collectionID, permission)
		if err != nil {
			return err
		}

		hasPermission = hookHasPermission
		return nil
	}, plugin.UserHasPermissionToCollectionID)
	if err != nil {
		return false, errors.Wrapf(err, "plugin %s failed to determine if user has permission to collection", pluginId)
	}

	return hasPermission, nil
}

// GetTopicMetadataById resolves the topic metadata for the given topic against the plugin that
// registered the associated topic type.
func (a *App) GetTopicMetadataById(topicType, topicId string) (*model.TopicMetadata, error) {
	pluginsEnvironment := a.Channels().GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil, errors.Errorf("failed to GetTopicMetadataById: no plugins environment")
	}

	pluginId, err := a.GetPluginIdForTopicType(topicType)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get GetTopicMetadataById")
	}

	var topicMetadata *model.TopicMetadata
	err = pluginsEnvironment.RunPluginHook(pluginId, func(hooks plugin.Hooks) error {
		var topicMetadatas map[string]*model.TopicMetadata
		topicMetadatas, err = hooks.GetTopicMetadataByIds(&plugin.Context{}, topicType, []string{topicId})
		if err != nil {
			return err
		}

		// Note that this may be nil, if the plugin has no metadata to offer.
		topicMetadata = topicMetadatas[topicId]
		return nil
	}, plugin.GetTopicMetadataByIdsID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to invoke hook GetTopicMetadataById")
	}

	return topicMetadata, nil
}
