// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from '../utils/utils.jsx';

import {FormattedMessage} from 'mm-intl';

var Popover = ReactBootstrap.Popover;
var OverlayTrigger = ReactBootstrap.OverlayTrigger;

var id = 0;

function nextId() {
    id = id + 1;
    return id;
}

export default class UserProfile extends React.Component {
    constructor(props) {
        super(props);
        this.uniqueId = nextId();
    }
    componentDidMount() {
        if (!this.props.disablePopover) {
            $('body').tooltip({selector: '[data-toggle=tooltip]', trigger: 'hover click'});
        }
    }
    render() {
        let name = '...';
        let email = '';
        let profileImg = '';
        if (this.props.user) {
            name = Utils.displayUsername(this.props.user.id);
            email = this.props.user.email;
            profileImg = '/api/v1/users/' + this.props.user.id + '/image?time=' + this.props.user.update_at;
        }

        if (this.props.overwriteName) {
            name = this.props.overwriteName;
        }

        if (this.props.overwriteImage) {
            profileImg = this.props.overwriteImage;
        }

        if (this.props.disablePopover) {
            return <div>{name}</div>;
        }

        var dataContent = [];
        dataContent.push(
            <img
                className='user-popover__image'
                src={profileImg}
                height='128'
                width='128'
                key='user-popover-image'
            />
        );

        if (!global.window.mm_config.ShowEmailAddress === 'true') {
            dataContent.push(
                <div
                    className='text-nowrap'
                    key='user-popover-no-email'
                >
                    <FormattedMessage
                        id='user_profile.notShared'
                        defaultMessage='Email not shared'
                    />
                </div>
            );
        } else {
            dataContent.push(
                <div
                    data-toggle='tooltip'
                    title={email}
                    key='user-popover-email'
                >
                    <a
                        href={'mailto:' + email}
                        className='text-nowrap text-lowercase user-popover__email'
                    >
                        {email}
                    </a>
                </div>
            );
        }

        return (
            <OverlayTrigger
                trigger='click'
                placement='right'
                rootClose={true}
                overlay={
                    <Popover
                        title={name}
                        id='user-profile-popover'
                    >
                        {dataContent}
                    </Popover>
                }
            >
                <div
                    className='user-popover'
                    id={'profile_' + this.uniqueId}
                >
                    {name}
                </div>
            </OverlayTrigger>
        );
    }
}

UserProfile.defaultProps = {
    user: {},
    overwriteName: '',
    overwriteImage: '',
    disablePopover: false
};
UserProfile.propTypes = {
    user: React.PropTypes.object,
    overwriteName: React.PropTypes.string,
    overwriteImage: React.PropTypes.string,
    disablePopover: React.PropTypes.bool
};
