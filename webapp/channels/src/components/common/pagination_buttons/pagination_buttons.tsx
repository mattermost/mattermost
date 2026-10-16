// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {
    ChevronLeftIcon,
    ChevronRightIcon,
} from '@mattermost/compass-icons/components';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

export type PaginationButtonsProps = {

    /**
     * When omitted, the previous button is not rendered (e.g. list_table optional controls).
     */
    onPrevious?: (event: React.MouseEvent<HTMLButtonElement>) => void;

    /**
     * When omitted, the next button is not rendered.
     */
    onNext?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    disablePrevious?: boolean;
    disableNext?: boolean;
    isLoading?: boolean;

    /**
     * Accessible name and tooltip for the previous button. Defaults to “Go to previous page”.
     */
    previousLabel?: string;

    /**
     * Accessible name and tooltip for the next button. Defaults to “Go to next page”.
     */
    nextLabel?: string;

    /**
     * When set, wraps the buttons in a div with this class (e.g. list_table `paginationButtons`).
     * When omitted, buttons are rendered as siblings with no wrapper.
     */
    className?: string;
    previousButtonClassName?: string;
    nextButtonClassName?: string;
    previousButtonTestId?: string;
    nextButtonTestId?: string;
};

const PaginationButtons = ({
    onPrevious,
    onNext,
    disablePrevious = false,
    disableNext = false,
    isLoading = false,
    previousLabel,
    nextLabel,
    className,
    previousButtonClassName,
    nextButtonClassName,
    previousButtonTestId,
    nextButtonTestId,
}: PaginationButtonsProps) => {
    const {formatMessage} = useIntl();

    const resolvedPreviousLabel = previousLabel ?? formatMessage({
        id: 'adminConsole.list.table.pagination.previous',
        defaultMessage: 'Go to previous page',
    });
    const resolvedNextLabel = nextLabel ?? formatMessage({
        id: 'adminConsole.list.table.pagination.next',
        defaultMessage: 'Go to next page',
    });

    const buttons = (
        <>
            {onPrevious && (
                <WithTooltip title={resolvedPreviousLabel}>
                    <IconButton
                        size='small'
                        className={previousButtonClassName}
                        icon={<Icon glyph={<ChevronLeftIcon/>}/>}
                        disabled={disablePrevious || isLoading}
                        onClick={onPrevious}
                        aria-label={resolvedPreviousLabel}
                        data-testid={previousButtonTestId}
                    />
                </WithTooltip>
            )}
            {onNext && (
                <WithTooltip title={resolvedNextLabel}>
                    <IconButton
                        size='small'
                        className={nextButtonClassName}
                        icon={<Icon glyph={<ChevronRightIcon/>}/>}
                        disabled={disableNext || isLoading}
                        onClick={onNext}
                        aria-label={resolvedNextLabel}
                        data-testid={nextButtonTestId}
                    />
                </WithTooltip>
            )}
        </>
    );

    if (className) {
        return (
            <div className={className}>
                {buttons}
            </div>
        );
    }

    return buttons;
};

export default PaginationButtons;
