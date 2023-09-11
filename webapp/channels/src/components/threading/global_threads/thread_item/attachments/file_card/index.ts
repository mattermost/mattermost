// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import type {FileInfo} from '@mattermost/types/files';

import {getFile} from 'mattermost-redux/selectors/entities/files';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

import FileCard from './file_card';

type OwnProps = {
    id: FileInfo['id'];
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const file = getFile(state, ownProps.id);
    const config = getConfig(state);

    return {
        file,
        enableSVGs: config.EnableSVGs === 'true',
    };
}

export default connect(mapStateToProps)(FileCard);
