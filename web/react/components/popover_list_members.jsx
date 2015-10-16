// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');
var Popover = ReactBootstrap.Popover;
var OverlayTrigger = ReactBootstrap.OverlayTrigger;

export default class PopoverListMembers extends React.Component {
    componentDidMount() {
        const originalLeave = $.fn.popover.Constructor.prototype.leave;
        $.fn.popover.Constructor.prototype.leave = function onLeave(obj) {
            let selfObj;
            if (obj instanceof this.constructor) {
                selfObj = obj;
            } else {
                selfObj = $(obj.currentTarget)[this.type](this.getDelegateOptions()).data(`bs.${this.type}`);
            }
            originalLeave.call(this, obj);

            if (obj.currentTarget && selfObj.$tip) {
                selfObj.$tip.one('mouseenter', function onMouseEnter() {
                    clearTimeout(selfObj.timeout);
                    selfObj.$tip.one('mouseleave', function onMouseLeave() {
                        $.fn.popover.Constructor.prototype.leave.call(selfObj, selfObj);
                    });
                });
            }
        };
    }
    render() {
        let popoverHtml = [];
        let count = 0;
        let countText = '-';
        const members = this.props.members;
        const teamMembers = UserStore.getProfilesUsernameMap();

        if (members && teamMembers) {
            members.sort((a, b) => {
                return a.username.localeCompare(b.username);
            });

            members.forEach((m, i) => {
                if (teamMembers[m.username] && teamMembers[m.username].delete_at <= 0) {
                    popoverHtml.push(
                        <div
                            className='text--nowrap'
                            key={'popover-member-' + i}
                        >
                            {m.username}
                        </div>
                    );
                    count++;
                }
            });

            if (count > 20) {
                countText = '20+';
            } else if (count > 0) {
                countText = count.toString();
            }
        }

        return (
            <OverlayTrigger
                trigger='click'
                placement='bottom'
                rootClose={true}
                overlay={
                    <Popover
                        title='Members'
                        id='member-list-popover'
                    >
                        {popoverHtml}
                    </Popover>
                }
            >
            <div id='member_popover'>
                <div>
                    {countText}
                    <span
                        className='fa fa-user'
                        aria-hidden='true'
                    />
                </div>
            </div>
            </OverlayTrigger>
        );
    }
}

PopoverListMembers.propTypes = {
    members: React.PropTypes.array.isRequired,
    channelId: React.PropTypes.string.isRequired
};
