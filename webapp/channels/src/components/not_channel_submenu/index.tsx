import React from 'react';
import type { Menu as ChannelMenu } from 'types/store/plugins';
import { Constants, ModalIdentifiers } from 'utils/constants';
import { localizeMessage } from 'utils/utils';
import EditChannelHeaderModal from 'components/edit_channel_header_modal';
import ConvertGmToChannelModal, { Actions } from 'components/convert_gm_to_channel_modal';
import type { Channel } from '@mattermost/types/channels';
import { CogOutlineIcon } from '@mattermost/compass-icons/components';
import { openModal } from 'actions/views/modals';
import Menu from 'components/widgets/menu/menu';
import { useDispatch } from 'react-redux';
import type {UserProfile} from '@mattermost/types/users';
type Props = {
    channel: Channel;
    isArchived: boolean;
    isReadonly: boolean;
    isGuest: boolean;
    onExited: () => void;
    actions: Actions;
    profilesInChannel: UserProfile[];
    teammateNameDisplaySetting: string;
    currentUserId: string;
   
}
export const NotChannelSubMenu: React.FC<Props> = ({ channel, isArchived, isReadonly, isGuest,onExited,actions,profilesInChannel,teammateNameDisplaySetting,currentUserId}) => {
    const dispatch = useDispatch();
    const menuItems: ChannelMenu[] = [
        {
            id: "channelEditHeader",
            text: localizeMessage({id:'channel_header.setGMConversationHeader', defaultMessage:'Edit Header'}),
            filter:()=> channel.type === Constants.GM_CHANNEL && !isArchived && !isReadonly,
            action: () => {
                dispatch(openModal({
                    modalId: ModalIdentifiers.EDIT_CHANNEL_HEADER,
                    dialogType: EditChannelHeaderModal,
                    dialogProps: { channel }, 
                }));
            },
         },
        {
            id: "convertGMPrivateChannel",
            text:localizeMessage({id:'sidebar_left.sidebar_channel_menu_convert_to_channel', defaultMessage:'Convert to Private Channel'}),
            filter:()=>channel.type === Constants.GM_CHANNEL && !isArchived && !isReadonly && !isGuest,
            action: () => {
                dispatch(openModal({
                    modalId: ModalIdentifiers.CONVERT_GM_TO_CHANNEL,
                    dialogType: ConvertGmToChannelModal,
                    dialogProps: { channel,onExited,actions,profilesInChannel,teammateNameDisplaySetting,currentUserId}, 
                }));
            },
        }
    ];
    return (
        <Menu.ItemSubMenu
            id="groupChannelActions"
            text={localizeMessage({id:'channel_header.groupChannelSettings', defaultMessage:' Settings'})}
            subMenuClass="group-channel-actions-submenu"
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
export default (NotChannelSubMenu)