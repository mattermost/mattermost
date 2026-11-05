// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import DraftsEmptyIllustration from '@mattermost/compass-ui/illustrations/drafts-empty';
import FileSearchEmptyIllustration from '@mattermost/compass-ui/illustrations/file-search-empty';
import GroupIllustration from '@mattermost/compass-ui/illustrations/group';
import GroupsIllustration from '@mattermost/compass-ui/illustrations/groups';
import MentionsEmptyIllustration from '@mattermost/compass-ui/illustrations/mentions-empty';
import MessageSearchEmptyIllustration from '@mattermost/compass-ui/illustrations/message-search-empty';
import PinnedEmptyIllustration from '@mattermost/compass-ui/illustrations/pinned-empty';
import SavedEmptyIllustration from '@mattermost/compass-ui/illustrations/saved-empty';
import ScheduledEmptyIllustration from '@mattermost/compass-ui/illustrations/scheduled-empty';
import SearchIllustration from '@mattermost/compass-ui/illustrations/search';
import ThreadsEmptyIllustration from '@mattermost/compass-ui/illustrations/threads-empty';

import {NoResultsVariant} from './types';

type IllustrationComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const compassVariantIllustrations: Partial<Record<NoResultsVariant, IllustrationComponent>> = {
    [NoResultsVariant.Search]: MessageSearchEmptyIllustration,
    [NoResultsVariant.Files]: FileSearchEmptyIllustration,
    [NoResultsVariant.ChannelSearch]: SearchIllustration,
    [NoResultsVariant.Mentions]: MentionsEmptyIllustration,
    [NoResultsVariant.MentionsFiltered]: MentionsEmptyIllustration,
    [NoResultsVariant.FlaggedPosts]: SavedEmptyIllustration,
    [NoResultsVariant.PinnedPosts]: PinnedEmptyIllustration,
    [NoResultsVariant.ChannelFiles]: FileSearchEmptyIllustration,
    [NoResultsVariant.ChannelFilesFiltered]: FileSearchEmptyIllustration,
    [NoResultsVariant.UserGroups]: GroupsIllustration,
    [NoResultsVariant.UserGroupMembers]: GroupIllustration,
    [NoResultsVariant.UserGroupsArchived]: GroupsIllustration,
};

export function renderNoResultsVariantIllustration(variant: NoResultsVariant): React.ReactNode {
    const Illustration = compassVariantIllustrations[variant];
    if (Illustration) {
        return <Illustration/>;
    }

    return null;
}

export {
    DraftsEmptyIllustration,
    ScheduledEmptyIllustration,
    ThreadsEmptyIllustration,
};
