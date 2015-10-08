// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var UserStore = require('../stores/user_store.jsx');

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

        $('#member_popover').popover({placement: 'bottom', trigger: 'click', html: true});
        $('body').on('click', function onClick(e) {
            if (e.target.parentNode && $(e.target.parentNode.parentNode)[0] !== $('#member_popover')[0] && $(e.target).parents('.popover.in').length === 0) {
                $('#member_popover').popover('hide');
            }
        });
    }
    render() {
        let popoverHtml = '';
        let count = 0;
        let countText = '-';
        const members = this.props.members;
        const teamMembers = UserStore.getProfilesUsernameMap();

        if (members && teamMembers) {
            members.sort(function compareByLocal(a, b) {
                return a.username.localeCompare(b.username);
            });

            members.forEach(function addMemberElement(m) {
                if (teamMembers[m.username] && teamMembers[m.username].delete_at <= 0) {
                    popoverHtml += `<div class='text--nowrap'>${m.username}</div>`;
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
            <div
                id='member_popover'
                data-toggle='popover'
                data-content={popoverHtml}
                data-original-title='Members'
            >
                <div
                    id='member_tooltip'
                >
                    {countText}
                    <span
                        className='fa fa-user'
                        aria-hidden='true'
                    />
                </div>
            </div>
        );
    }
}

PopoverListMembers.propTypes = {
    members: React.PropTypes.array.isRequired,
    channelId: React.PropTypes.string.isRequired
};
