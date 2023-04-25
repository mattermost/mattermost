// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {openModal} from 'actions/views/modals';

import MarkdownImage from './markdown_image';

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

const connector = connect(null, mapDispatchToProps);

export default connector(MarkdownImage);
