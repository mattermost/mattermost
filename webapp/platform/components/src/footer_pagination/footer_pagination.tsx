// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';

import {ChevronLeftIcon, ChevronRightIcon} from '@mattermost/compass-icons/components';

import './footer_pagination.scss';

const BUTTON_ICON_SIZE = 16;

type Props = {
    page: number;
    total: number;
    itemsPerPage: number;
    onNextPage: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    onPreviousPage: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
};

export const FooterPagination = ({
    page,
    total,
    itemsPerPage,
    onNextPage,
    onPreviousPage,
}: Props) => {
    const {formatMessage} = useIntl();

    const startCount = page * itemsPerPage;
    const endCount = Math.min(startCount + itemsPerPage, total);
    const totalPages = Math.trunc((total - 1) / itemsPerPage);

    const prevDisabled = page <= 0;
    const nextDisabled = page >= totalPages;

    return (
        <div className='footer-pagination'>
            <div className='footer-pagination__legend'>
                {Boolean(total) && (
                    formatMessage(
                        {
                            id: 'footer_pagination.count',
                            defaultMessage: 'Showing {startCount, number}-{endCount, number} of {total, number}',
                        },
                        {
                            startCount: startCount + 1,
                            endCount,
                            total,
                        },
                    )
                )}
            </div>
            <div className='footer-pagination__button-container'>
                <button
                    type='button'
                    className={classNames(
                        'footer-pagination__button-container__button',
                        {disabled: prevDisabled},
                    )}
                    onClick={onPreviousPage}
                    disabled={prevDisabled}
                >
                    <ChevronLeftIcon size={BUTTON_ICON_SIZE}/>
                    <span>
                        {formatMessage({
                            id: 'footer_pagination.prev',
                            defaultMessage: 'Previous',
                        })}
                    </span>
                </button>
                <button
                    type='button'
                    className={classNames(
                        'footer-pagination__button-container__button',
                        {disabled: nextDisabled},
                    )}
                    onClick={onNextPage}
                    disabled={nextDisabled}
                >
                    <span>
                        {formatMessage({
                            id: 'footer_pagination.next',
                            defaultMessage: 'Next',
                        })}
                    </span>
                    <ChevronRightIcon size={BUTTON_ICON_SIZE}/>
                </button>
            </div>
        </div>
    );
};
