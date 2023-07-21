// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team} from '@mattermost/types/teams';
import classNames from 'classnames';
import React from 'react';
import {injectIntl, IntlShape} from 'react-intl';

import {imageURLForTeam} from 'utils/utils';

import './team_icon.scss';

type Props = {

    /** Team icon URL (when available) */
    url?: string | null;

    /** Team display name (used for the initials) if icon URL is not set */
    content: React.ReactNode;

    /**
     * Size of the icon, "sm", "md" or "lg".
     *
     * @default "regular"
     **/
    size?: 'sm' | 'lg';

    /** Whether to add hover effect to the icon */
    withHover?: boolean;

    /** Whether to add additional classnames */
    className?: string;

    /** react-intl helper object */
    intl: IntlShape;
};

/**
 * An icon representing a Team. If `url` is set - shows the image,
 * otherwise shows team initials
 */
export class TeamIcon extends React.PureComponent<Props> {
    public static defaultProps = {
        size: 'sm' as const,
    };

    public render() {
        const {content, url, size, withHover, className} = this.props;
        const hoverCss = withHover ? '' : 'no-hover';
        const {formatMessage} = this.props.intl;

        // FIXME Nowhere does imageURLForTeam seem to check for display_name.
        const teamIconUrl = url || imageURLForTeam({display_name: content} as Team);
        let icon;
        if (typeof content === 'string') {
            if (teamIconUrl) {
                icon = (
                    <div
                        data-testid='teamIconImage'
                        className={`TeamIcon__image TeamIcon__${size}`}
                        aria-label={
                            formatMessage({
                                id: 'sidebar.team_menu.button.teamImage',
                                defaultMessage: '{teamName} Team Image',
                            }, {
                                teamName: content,
                            })
                        }
                        style={{backgroundImage: `url('${teamIconUrl}')`}}
                        role={'img'}
                    />
                );
            } else {
                icon = (
                    <div
                        data-testid='teamIconInitial'
                        className={`TeamIcon__initials TeamIcon__initials__${size}`}
                        aria-label={
                            formatMessage({
                                id: 'sidebar.team_menu.button.teamInitials',
                                defaultMessage: '{teamName} Team Initials',
                            }, {
                                teamName: content,
                            })
                        }
                        role={'img'}
                    >
                        {content ? content.replace(/\s/g, '').substring(0, 2) : '??'}
                    </div>
                );
            }
        } else {
            icon = content;
        }
        return (
            <div className={classNames(`TeamIcon TeamIcon__${size}`, {withImage: teamIconUrl}, className, hoverCss)}>
                <div className={`TeamIcon__content ${hoverCss}`}>
                    {icon}
                </div>
            </div>
        );
    }
}

export default injectIntl(TeamIcon);
