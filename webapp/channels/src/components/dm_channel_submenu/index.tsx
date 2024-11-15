import React from 'react';
import type { Menu as ChannelMenu } from 'types/store/plugins';
import { Constants, ModalIdentifiers } from 'utils/constants';
import { localizeMessage } from 'utils/utils';
import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import type { Channel } from '@mattermost/types/channels';
import { CogOutlineIcon } from '@mattermost/compass-icons/components';
import { openModal } from 'actions/views/modals';
import Menu from 'components/widgets/menu/menu';
import { useDispatch } from 'react-redux';
type Props = {
    channel: Channel;
    isArchived: boolean;
    isReadonly: boolean;
}
export const DMChannelSubMenu: React.FC<Props> = ({ channel, isArchived, isReadonly }) => {
    const dispatch = useDispatch();
    const menuItems: ChannelMenu[] = [
        {
            id: "channelEditHeader",
            text: localizeMessage({id:'channel_header.DMsetConversationHeader', defaultMessage:'Edit Header'}),
            filter:()=> channel.type === Constants.DM_CHANNEL && !isArchived && !isReadonly,
            action: () => {
                dispatch(openModal({
                    modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
                    dialogType: EditChannelHeaderModal,
                    dialogProps: { channel }, 
                }));
            },
         }
    ];
    return (
        <Menu.ItemSubMenu
            id="dmChannelActions"
            text={localizeMessage({id:'channel_header.dmChannelSettings', defaultMessage:'Settings'})}
            subMenuClass="dm-channel-actions-submenu"
            subMenu={menuItems
                .filter(item=>item.filter?item.filter():false)
                .map(item => ({
                    id: item.id,
                    text: item.text,
                   action:item.action,
                }))}
            direction="right"
            icon={
                <span style={{ fontSize: '1.25rem', verticalAlign: 'middle', marginLeft: '2' }}>
                    <CogOutlineIcon color='#808080' size={18} />
                </span>}
        />
    );
};
export default (DMChannelSubMenu)