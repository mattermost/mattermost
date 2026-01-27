// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback} from 'react';
import {useIntl} from 'react-intl';
import classNames from 'classnames';

import MagnifyIcon from '@mattermost/compass-icons/components/magnify';

import WithTooltip from 'components/with_tooltip';

import * as UserAgent from 'utils/user_agent';

import './search_button.scss';

/**
 * SearchButton renders a search icon that triggers the global search modal.
 * - Dispatches synthetic Cmd/Ctrl+Shift+F keyboard event to trigger NewSearch
 * - Shows active state (blue bar) while search modal is open
 * - Clears active state on Escape or click outside
 */
const SearchButton = (): JSX.Element => {
    const {formatMessage} = useIntl();
    const [isActive, setIsActive] = useState(false);

    /**
     * Triggers global search by dispatching synthetic keyboard event.
     * NewSearch component listens for Cmd/Ctrl+Shift+F on web.
     */
    const triggerSearch = useCallback(() => {
        const isMac = UserAgent.isMac();
        const event = new KeyboardEvent('keydown', {
            key: 'f',
            code: 'KeyF',
            keyCode: 70,
            ctrlKey: !isMac,
            metaKey: isMac,
            shiftKey: true,
            bubbles: true,
        });
        document.dispatchEvent(event);
        setIsActive(true);
    }, []);

    /**
     * Handle click on the search button
     */
    const handleClick = useCallback(() => {
        triggerSearch();
    }, [triggerSearch]);

    /**
     * Listen for Escape key and click outside to clear active state.
     * This detects when the search modal is closed.
     */
    useEffect(() => {
        if (!isActive) {
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsActive(false);
            }
        };

        const handleClickOutside = (e: MouseEvent) => {
            // Small delay to allow the search modal click events to process
            // If search modal is closed by clicking outside, clear active state
            setTimeout(() => {
                const searchContainer = document.querySelector('.search__form');
                const searchPopover = document.querySelector('.search-hint-popover');
                if (!searchContainer && !searchPopover) {
                    setIsActive(false);
                }
            }, 100);
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('click', handleClickOutside);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isActive]);

    const tooltipTitle = formatMessage({
        id: 'product_sidebar.search',
        defaultMessage: 'Search',
    });

    const ariaLabel = formatMessage({
        id: 'product_sidebar.search.ariaLabel',
        defaultMessage: 'Open search',
    });

    return (
        <WithTooltip
            title={tooltipTitle}
            isVertical={false}
        >
            <button
                type="button"
                className={classNames('SearchButton', {
                    'SearchButton--active': isActive,
                })}
                onClick={handleClick}
                aria-label={ariaLabel}
            >
                <MagnifyIcon
                    size={20}
                    color={isActive ? 'var(--sidebar-text)' : 'rgba(var(--sidebar-text-rgb), 0.64)'}
                />
            </button>
        </WithTooltip>
    );
};

export default SearchButton;
