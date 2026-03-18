// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ContentFlaggingConfig} from '@mattermost/types/content_flagging';
import type {NameMappedPropertyFields, PropertyValue} from '@mattermost/types/properties';

import {
    getContentFlaggingConfig,
    getPostContentFlaggingValues,
    loadPostContentFlaggingFields,
} from 'mattermost-redux/actions/content_flagging';
import {
    contentFlaggingConfig,
    contentFlaggingFields,
    postContentFlaggingValues,
} from 'mattermost-redux/selectors/entities/content_flagging';

import {makeUseEntity} from 'components/common/hooks/useEntity';

export const useContentFlaggingFields = makeUseEntity<NameMappedPropertyFields | undefined>({
    name: 'useContentFlaggingFields',
    fetch: loadPostContentFlaggingFields,
    selector: contentFlaggingFields,
});

export const usePostContentFlaggingValues = makeUseEntity<Array<PropertyValue<unknown>>>({
    name: 'usePostContentFlaggingValues',
    fetch: getPostContentFlaggingValues,
    selector: postContentFlaggingValues,
});

export const useContentFlaggingConfig = makeUseEntity<ContentFlaggingConfig>({
    name: 'useContentFlaggingConfig',
    fetch: getContentFlaggingConfig,
    selector: contentFlaggingConfig,
});
