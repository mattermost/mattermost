// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    useClick,
    useDismiss,
    useRole,
    useInteractions,
    useFloating,
    autoUpdate,
    FloatingFocusManager,
    FloatingPortal,
    useTransitionStyles,
    FloatingOverlay,
    autoPlacement,
} from '@floating-ui/react';
import classNames from 'classnames';
import React, {useState} from 'react';
import styled from 'styled-components';

import ProfilePopover from 'components/profile_popover/profile_popover_imp';
import StatusIcon from 'components/status_icon';
import StatusIconNew from 'components/status_icon_new';
import Avatar, {getAvatarWidth} from 'components/widgets/users/avatar';
import type {TAvatarSizeToken} from 'components/widgets/users/avatar';

import {A11yClassNames} from 'utils/constants';

import './profile_picture.scss';

type Props = {
    size?: TAvatarSizeToken;
    isEmoji?: boolean;
    wrapperClass?: string;
    profileSrc?: string;
    src: string;
    isBot?: boolean;
    fromAutoResponder?: boolean;
    status?: string;
    fromWebhook?: boolean;
    userId?: string;
    channelId?: string;
    username?: string;
    overwriteIcon?: string;
    overwriteName?: string;
    newStatusIcon?: boolean;
    statusClass?: string;
    popoverPlacement?: string;
}

function ProfilePicture(props: Props) {
    const [isProfilePopoverOpen, setIsProfilePopoverOpen] = useState(false);

    const {refs: profilePopoverRefs, floatingStyles: profilePopoverFloatingStyles, context: profilePopoverfloatingContext} = useFloating({
        open: isProfilePopoverOpen,
        onOpenChange: setIsProfilePopoverOpen,
        whileElementsMounted: autoUpdate,
        middleware: [
            autoPlacement({
                allowedPlacements: ['top-start', 'bottom-start', 'right-start'],
            }),
        ],
    });
    const {isMounted: isProfilePopoverMounted, styles: profilePopoverTransistionStyles} = useTransitionStyles(profilePopoverfloatingContext, {
        duration: {
            open: 100,
            close: 300,
        },
    });
    const avatarClick = useClick(profilePopoverfloatingContext);
    const profilePopoverDismiss = useDismiss(profilePopoverfloatingContext);
    const profilePopoverrole = useRole(profilePopoverfloatingContext);
    const {getReferenceProps: getAvatarReferenceProps, getFloatingProps: getProfilePopoverFloatinProps} = useInteractions([
        avatarClick,
        profilePopoverDismiss,
        profilePopoverrole,
    ]);

    // profileSrc will, if possible, be the original user profile picture even if the icon
    // for the post is overriden, so that the popup shows the user identity
    const profileSrc = typeof props.profileSrc === 'string' && props.profileSrc !== '' ? props.profileSrc : props.src;

    const profileIconClass = `profile-icon ${props.isEmoji ? 'emoji' : ''}`;

    const hideStatus = props.isBot || props.fromAutoResponder || props.fromWebhook;

    function hideProfilePopover() {
        setIsProfilePopoverOpen(false);
    }

    if (props.userId) {
        return (
            <>
                <span
                    className={classNames('status-wrapper', props.wrapperClass)}
                    ref={profilePopoverRefs.setReference}
                    {...getAvatarReferenceProps()}
                >
                    <RoundButton
                        className='style--none'
                        size={props?.size ?? 'md'}
                    >
                        <span className={profileIconClass}>
                            <Avatar
                                username={props.username}
                                size={props.size}
                                url={props.src}
                            />
                        </span>
                    </RoundButton>
                    <StatusIcon status={props.status}/>
                </span>
                {isProfilePopoverMounted && (
                    <FloatingPortal>
                        <FloatingOverlay lockScroll={true}>
                            <FloatingFocusManager context={profilePopoverfloatingContext}>
                                <div
                                    id='user-profile-popover'
                                    ref={profilePopoverRefs.setFloating}
                                    style={Object.assign({}, profilePopoverFloatingStyles, profilePopoverTransistionStyles)}
                                    className={classNames('user-profile-popover', A11yClassNames.POPUP)}
                                    {...getProfilePopoverFloatinProps()}
                                >
                                    <ProfilePopover
                                        userId={props.userId}
                                        src={profileSrc}
                                        channelId={props.channelId}
                                        hide={hideProfilePopover}
                                        overwriteIcon={props.overwriteIcon}
                                        overwriteName={props.overwriteName}
                                        fromWebhook={props.fromWebhook}
                                        hideStatus={hideStatus}
                                    />
                                </div>
                            </FloatingFocusManager>
                        </FloatingOverlay>
                    </FloatingPortal>
                )}
            </>
        );
    }

    return (
        <span
            className={classNames('status-wrapper', 'style--none', props.wrapperClass)}
        >
            <span className={profileIconClass}>
                <Avatar
                    size={props?.size ?? 'md'}
                    url={props.src}
                />
            </span>
            {props.newStatusIcon ? (
                <StatusIconNew
                    className={props.statusClass}
                    status={props.status}
                />
            ) : (
                <StatusIcon status={props.status}/>
            )}
        </span>
    );
}

// class ProfilePicture extends React.PureComponent<Props> {
//     public static defaultProps = {
//         size: 'md',
//         isEmoji: false,
//         hasMention: false,
//         wrapperClass: '',
//         popoverPlacement: 'right',
//     };

//     overlay = React.createRef<MMOverlayTrigger>();
//     buttonRef = React.createRef<HTMLButtonElement>();

//     public hideProfilePopover = () => {
//         if (this.overlay.current) {
//             this.overlay.current.hide();
//         }
//     };

//     public render() {
//         // profileSrc will, if possible, be the original user profile picture even if the icon
//         // for the post is overriden, so that the popup shows the user identity
//         const profileSrc = (typeof this.props.profileSrc === 'string' && this.props.profileSrc !== '') ? this.props.profileSrc : this.props.src;

//         const profileIconClass = `profile-icon ${this.props.isEmoji ? 'emoji' : ''}`;

//         const hideStatus = this.props.isBot || this.props.fromAutoResponder || this.props.fromWebhook;

//         if (this.props.userId) {
//             return (
//                 <OverlayTrigger
//                     ref={this.overlay}
//                     trigger={['click']}
//                     placement={this.props.popoverPlacement}
//                     rootClose={true}
//                     overlay={
//                         <ProfilePopover
//                             className='user-profile-popover'
//                             userId={this.props.userId}
//                             src={profileSrc}
//                             hide={this.hideProfilePopover}
//                             channelId={this.props.channelId}
//                             overwriteIcon={this.props.overwriteIcon}
//                             overwriteName={this.props.overwriteName}
//                             fromWebhook={this.props.fromWebhook}
//                             hideStatus={hideStatus}
//                         />
//                     }
//                 >
//                     <span className={`status-wrapper  ${this.props.wrapperClass}`}>
//                         <RoundButton
//                             className='style--none'
//                             size={this.props?.size ?? 'md'}
//                             ref={this.buttonRef}
//                         >
//                             <span className={profileIconClass}>
//                                 <Avatar
//                                     username={this.props.username}
//                                     size={this.props.size}
//                                     url={this.props.src}
//                                     tabIndex={-1}
//                                 />
//                             </span>
//                         </RoundButton>
//                         <StatusIcon status={this.props.status}/>
//                     </span>
//                 </OverlayTrigger>
//             );
//         }

//         return (
//             <span className={`status-wrapper style--none ${this.props.wrapperClass}`}>
//                 <span className={profileIconClass}>
//                     <Avatar
//                         size={this.props.size}
//                         url={this.props.src}
//                     />
//                 </span>
//                 {this.props.newStatusIcon ? (
//                     <StatusIconNew
//                         className={this.props.statusClass}
//                         status={this.props.status}
//                     />
//                 ) : <StatusIcon status={this.props.status}/>}
//             </span>
//         );
//     }
// }

const RoundButton = styled.button<{size: TAvatarSizeToken}>`
    border-radius: 50%;
    width: ${(p) => getAvatarWidth(p.size)}px;
    height: ${(p) => getAvatarWidth(p.size)}px;
`;

export default ProfilePicture;
