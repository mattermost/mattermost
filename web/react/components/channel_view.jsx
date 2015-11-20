// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import CenterPanel from '../components/center_panel.jsx';
import Sidebar from '../components/sidebar.jsx';
import SidebarRight from '../components/sidebar_right.jsx';
import SidebarRightMenu from '../components/sidebar_right_menu.jsx';

export default class ChannelView extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        return (
            <div className='container-fluid'>
                <div
                    className='sidebar--right'
                    id='sidebar-right'
                >
                    <SidebarRight/>
                </div>
                <div
                    className='sidebar--menu'
                    id='sidebar-menu'
                >
                    <SidebarRightMenu/>
                </div>
                <div
                    className='sidebar--left'
                    id='sidebar-left'
                >
                    <Sidebar/>
                </div>
                <CenterPanel />
            </div>
        );
    }
}
ChannelView.defaultProps = {
};

ChannelView.propTypes = {
};
