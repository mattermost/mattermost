import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Menu from 'components/widgets/menu/menu';
import Constants, { ModalIdentifiers } from 'utils/constants';
import ChannelPermissionGate from 'components/permissions_gates/channel_permission_gate';
import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import EditChannelPurposeModal from 'components/edit_channel_purpose_modal';
import RenameChannelModal from 'components/rename_channel_modal';
import ConvertChannelModal from 'components/convert_channel_modal';
import type { Channel } from '@mattermost/types/channels';
import { Permissions } from 'mattermost-redux/constants';
import { CogOutlineIcon } from '@mattermost/compass-icons/components';
import { localizeMessage } from 'mattermost-redux/utils/i18n_utils';
import type { Menu as ChannelMenu } from 'types/store/plugins';
import { openModal } from 'actions/views/modals'; // Update with the actual path
import { GlobalState } from 'types/store';
import { haveIChannelPermission } from 'mattermost-redux/selectors/entities/roles';
import { useSelect } from '@mui/base';
import { useEffect } from 'react';
import { isVisible } from '@testing-library/user-event/dist/utils';
import { FormattedMessage } from 'react-intl';
type Props = {
    channel: Channel;
    isArchived: boolean;
    isReadonly: boolean;
    isDefault: boolean;
};
const hasPermission = (channel: Channel, permission: string, state: GlobalState) => {
    if (!channel.id || channel.team_id === null) {
        return false;
    }
    return haveIChannelPermission(state, channel.team_id, channel.id, permission);
}
export const ChannelActionsMenu: React.FC<Props> = ({ channel, isArchived, isReadonly, isDefault }) => {
    const dispatch = useDispatch();
    const isPrivate = channel.type === Constants.PRIVATE_CHANNEL;
    const hasPrivateChannelPermission = useSelector((state: GlobalState) => {
        return hasPermission(channel, Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES, state);
    });
    const hasPublicChannelPermission = useSelector((state: GlobalState) => {
        return hasPermission(channel, Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES, state);
    });
    const privateChannelConversion = useSelector((state: GlobalState) => {
        return hasPermission(channel, Permissions.CONVERT_PUBLIC_CHANNEL_TO_PRIVATE, state);
    });
    const channelActionsSubMenu: ChannelMenu[] = [
        {
            id: 'channelEditHeader',
            text: localizeMessage({id:'channel_header.setHeader', defaultMessage:'Edit Channel Header'}),
            filter: () => channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL && !isArchived && !isReadonly && ((hasPrivateChannelPermission && isPrivate) || (!isPrivate && hasPublicChannelPermission)),
            action: () => dispatch(openModal({
                modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
                dialogType: EditChannelHeaderModal,
                dialogProps: { channel },
            })),
        },
        {
            id: 'channelEditPurpose',
            text: localizeMessage({id:'channel_header.setPurpose', defaultMessage:'Edit Channel Purpose'}),
            filter: () => !isArchived && !isReadonly && channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL && ((hasPrivateChannelPermission && isPrivate) || (!isPrivate && hasPublicChannelPermission)),
            action: () => dispatch(openModal({
                modalId: ModalIdentifiers.EDIT_CHANNEL_PURPOSE,
                dialogType: EditChannelPurposeModal,
                dialogProps: { channel },
            })),
        },
        {
            id: 'channelRename',
            text: localizeMessage({id:'channel_header.rename', defaultMessage:'Rename Channel'}),
            filter: () => !isArchived && channel.type !== Constants.DM_CHANNEL && channel.type !== Constants.GM_CHANNEL && ((hasPrivateChannelPermission && isPrivate) || (!isPrivate && hasPublicChannelPermission)),
            action: () => dispatch(openModal({
                modalId: ModalIdentifiers.RENAME_CHANNEL,
                dialogType: RenameChannelModal,
                dialogProps: { channel },
            })),
        },
        {
            id: 'channelConvertToPrivate',
            text: localizeMessage({id:'channel_header.convert', defaultMessage:'Convert to Private Channel'}),
            filter: () => !isArchived && !isDefault && channel.type === Constants.OPEN_CHANNEL && privateChannelConversion,
            action: () => dispatch(openModal({
                modalId: ModalIdentifiers.CONVERT_CHANNEL,
                dialogType: ConvertChannelModal,
                dialogProps: {
                    channelId: channel.id,
                    channelDisplayName: channel.display_name,
                },
            })),
        },
    ];
    const menuItems: ChannelMenu[] = channelActionsSubMenu
        .filter(item=>item.filter?item.filter():false)
        .map(item => ({
            id: item.id,
            text: item.text,
            action: item.action,
        }));
    return (
        <Menu.ItemSubMenu
            id="channelActions"
            text={localizeMessage({id:'sidebar_left.sidebar_channel_menu.settings', defaultMessage:'Channel Settings'})}
            subMenuClass="channel-actions-submenu"
            subMenu={channelActionsSubMenu}
            icon={
                <span style={{ fontSize: '1.25rem', verticalAlign: 'middle', marginLeft: '2' }}>
                    <CogOutlineIcon color='#808080' size={18} />
                </span>
            }
            direction="right"
        />
    );
};
export default ChannelActionsMenu;