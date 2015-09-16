// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

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
        const members = this.props.members;
        let count;
        if (members.length > 20) {
            count = '20+';
        } else {
            count = members.length || '-';
        }

        if (members) {
            members.sort(function compareByLocal(a, b) {
                return a.username.localeCompare(b.username);
            });

            members.forEach(function addMemberElement(m) {
                popoverHtml += `<div class='text--nowrap'>${m.username}</div>`;
            });
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
                    data-placement='left'
                    data-toggle='tooltip'
                    title='View Channel Members'
                >
                    {count}
                    <span
                        className='glyphicon glyphicon-user'
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
