// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {loadPostContentFlaggingFields} from 'mattermost-redux/actions/content_flagging';
import {contentFlaggingFields} from 'mattermost-redux/selectors/entities/content_flagging';

import {makeUseEntity} from 'components/common/hooks/useEntity';

export const useContentFlaggingFields = makeUseEntity<PropertyField[] | undefined>({
    name: 'useContentFlaggingFields',
    fetch: loadPostContentFlaggingFields,
    selector: contentFlaggingFields,
});
