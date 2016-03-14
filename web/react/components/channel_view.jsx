// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import CenterPanel from '../components/center_panel.jsx';

export default class ChannelView extends React.Component {
    render() {
        return (
            <CenterPanel/>
        );
    }
}
ChannelView.defaultProps = {
};

ChannelView.propTypes = {
    params: React.PropTypes.object
};
