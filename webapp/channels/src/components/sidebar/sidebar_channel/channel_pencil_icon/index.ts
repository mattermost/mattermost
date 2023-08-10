// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getCurrentChannelId} from 'mattermost-redux/selectors/entities/channels';

import {getPostDraft} from 'selectors/rhs';

import {StoragePrefixes} from 'utils/constants';

import ChannelPencilIcon from './channel_pencil_icon';

import type {Channel} from '@mattermost/types/channels';
import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

type OwnProps = {
    id: Channel['id'];
}

function hasDraft(draft: PostDraft|null, id: Channel['id'], currentChannelId?: string): boolean {
    if (draft === null) {
        return false;
    }

    return Boolean(draft.message.trim() || draft.fileInfos.length || draft.uploadsInProgress.length) && currentChannelId !== id;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const currentChannelId = getCurrentChannelId(state);
    const draft = getPostDraft(state, StoragePrefixes.DRAFT, ownProps.id);

    return {
        hasDraft: hasDraft(draft, ownProps.id, currentChannelId),
    };
}

export default connect(mapStateToProps)(ChannelPencilIcon);
