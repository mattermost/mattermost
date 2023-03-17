// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import classNames from 'classnames';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import FlagIcon from 'components/widgets/icons/flag_icon';
import FlagIconFilled from 'components/widgets/icons/flag_icon_filled';
import Constants, {Locations, A11yCustomEventTypes} from 'utils/constants';
import {localizeMessage} from 'utils/utils';
import {t} from 'utils/i18n';
import type {flagPost, unflagPost} from 'actions/post_actions';

export type Actions = {
    flagPost: typeof flagPost;
    unflagPost: typeof unflagPost;
}

interface Props {
    location?: keyof typeof Locations;
    postId: string;
    isFlagged: boolean;
    actions: Actions;
}

interface State {
    a11yActive: boolean;
}

export default class PostFlagIcon extends React.PureComponent<Props, State> {
    static defaultProps = {
        location: Locations.CENTER,
    };

    private buttonRef: React.RefObject<HTMLButtonElement>

    constructor(props: Props) {
        super(props);

        this.buttonRef = React.createRef();

        this.state = {
            a11yActive: false,
        };
    }

    componentDidMount() {
        if (this.buttonRef.current) {
            this.buttonRef.current.addEventListener(A11yCustomEventTypes.ACTIVATE, this.handleA11yActivateEvent);
            this.buttonRef.current.addEventListener(A11yCustomEventTypes.DEACTIVATE, this.handleA11yDeactivateEvent);
        }
    }
    componentWillUnmount() {
        if (this.buttonRef.current) {
            this.buttonRef.current.removeEventListener(A11yCustomEventTypes.ACTIVATE, this.handleA11yActivateEvent);
            this.buttonRef.current.removeEventListener(A11yCustomEventTypes.DEACTIVATE, this.handleA11yDeactivateEvent);
        }
    }

    componentDidUpdate() {
        if (this.state.a11yActive && this.buttonRef.current) {
            this.buttonRef.current.dispatchEvent(new Event(A11yCustomEventTypes.UPDATE));
        }
    }

    handlePress = (e: React.MouseEvent) => {
        e.preventDefault();

        const {
            actions,
            isFlagged,
            postId,
        } = this.props;

        if (isFlagged) {
            actions.unflagPost(postId);
        } else {
            actions.flagPost(postId);
        }
    }

    handleA11yActivateEvent = () => {
        this.setState({a11yActive: true});
    }

    handleA11yDeactivateEvent = () => {
        this.setState({a11yActive: false});
    }

    render() {
        const isFlagged = this.props.isFlagged;

        let flagIcon;
        if (isFlagged) {
            flagIcon = <FlagIconFilled className={classNames('icon', 'icon--small', 'icon--small-filled', {'post-menu__item--selected': isFlagged})}/>;
        } else {
            flagIcon = <FlagIcon className={classNames('icon', 'icon--small')}/>;
        }

        return (
            <OverlayTrigger
                className='hidden-xs'
                key={`flagtooltipkey${isFlagged ? 'flagged' : ''}`}
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='top'
                overlay={
                    <Tooltip
                        id='flagTooltip'
                        className='hidden-xs'
                    >
                        <FormattedMessage
                            id={isFlagged ? t('flag_post.unflag') : t('flag_post.flag')}
                            defaultMessage={isFlagged ? 'Remove from Saved' : 'Save'}
                        />
                    </Tooltip>
                }
            >
                <button
                    ref={this.buttonRef}
                    id={`${this.props.location}_flagIcon_${this.props.postId}`}
                    aria-label={isFlagged ? localizeMessage('flag_post.unflag', 'Remove from Saved').toLowerCase() : localizeMessage('flag_post.flag', 'Save').toLowerCase()}
                    className='post-menu__item'
                    onClick={this.handlePress}
                >
                    {flagIcon}
                </button>
            </OverlayTrigger>
        );
    }
}
