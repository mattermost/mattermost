// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {changeOpacity, makeStyleFromTheme} from 'mattermost-redux/utils/theme_utils';

import NavigationButton from './navigation_button';

export type NavigationRowProps = {
    page: number;
    total: number;
    maximumPerPage: number;
    onNextPageButtonClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    onPreviousPageButtonClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    theme: Theme;
};

export default class NavigationRow extends React.PureComponent <NavigationRowProps> {
    canShowNextButton = (): boolean => {
        const {page, maximumPerPage, total} = this.props;
        const totalPages = Math.trunc((total - 1) / maximumPerPage);

        return totalPages > page;
    };

    renderCount = (): JSX.Element => {
        const {page, total, maximumPerPage} = this.props;
        const startCount = page * maximumPerPage;
        const endCount = Math.min(startCount + maximumPerPage, total);

        return (
            <FormattedMessage
                id='marketplace_list.count_total_page'
                defaultMessage='{startCount, number} - {endCount, number} {total, plural, one {plugin} other {plugins}} of {total, number} total'
                values={{
                    startCount: startCount + 1,
                    endCount,
                    total,
                }}
            />
        );
    };

    render(): JSX.Element {
        const style = getStyle(this.props.theme);

        return (
            <div className='navigation-row'>
                <div className='col-xs-2'>
                    {(this.props.page > 0) && (
                        <NavigationButton
                            onClick={this.props.onPreviousPageButtonClick}
                            messageId={'more_channels.prev'}
                            defaultMessage={'Previous'}
                        />
                    )}
                </div>
                <div
                    className='col-xs-8 count'
                    style={style.count}
                >
                    {this.renderCount()}
                </div>
                <div className='col-xs-2'>
                    {this.canShowNextButton() && (
                        <NavigationButton
                            onClick={this.props.onNextPageButtonClick}
                            messageId={'more_channels.next'}
                            defaultMessage={'Next'}
                        />
                    )}
                </div>
            </div>
        );
    }
}

const getStyle = makeStyleFromTheme((theme) => {
    return {
        count: {
            color: changeOpacity(theme.centerChannelColor, 0.6),
        },
    };
});
