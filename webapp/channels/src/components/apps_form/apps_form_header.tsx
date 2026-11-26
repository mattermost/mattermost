// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useId, useRef, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import Markdown from 'components/markdown';

import './apps_form_header.scss';

type Props = {
    value: string;
};

const markdownOptions = {singleline: false, mentionHighlight: false};

const messages = defineMessages({
    scrollableTable: {
        id: 'apps_form.header.scrollableTable',
        defaultMessage: 'Scrollable table',
    },
});

const AppsFormHeader: React.FC<Props> = (props: Props) => {
    const headerRef = useRef<HTMLDivElement>(null);
    const hintId = useId();
    const intl = useIntl();
    const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);

    useEffect(() => {
        const tables = Array.from(headerRef.current?.querySelectorAll<HTMLDivElement>('.table-responsive') || []);
        const updateOverflow = () => {
            let hasOverflow = false;
            for (const table of tables) {
                const horizontal = table.scrollWidth > table.clientWidth;
                const vertical = table.scrollHeight > table.clientHeight;
                hasOverflow ||= horizontal;

                if (horizontal || vertical) {
                    table.setAttribute('tabindex', '0');
                    table.setAttribute('role', 'region');
                    table.setAttribute('aria-label', intl.formatMessage(messages.scrollableTable));
                } else {
                    table.removeAttribute('tabindex');
                    table.removeAttribute('role');
                    table.removeAttribute('aria-label');
                }

                if (horizontal) {
                    table.setAttribute('aria-describedby', hintId);
                } else {
                    table.removeAttribute('aria-describedby');
                }
            }
            setHasHorizontalOverflow(hasOverflow);
        };

        updateOverflow();
        const observer = new ResizeObserver(updateOverflow);
        for (const table of tables) {
            observer.observe(table);
            const content = table.querySelector('table');
            if (content) {
                observer.observe(content);
            }
        }

        return () => observer.disconnect();
    }, [props.value, hintId, intl]);

    return (
        <div
            ref={headerRef}
            className='AppsFormHeader'
        >
            {hasHorizontalOverflow && (
                <div
                    id={hintId}
                    className='AppsFormHeader__scrollHint'
                >
                    <FormattedMessage
                        id='apps_form.header.scrollHint'
                        defaultMessage='Scroll horizontally to see more columns.'
                    />
                </div>
            )}
            <Markdown
                message={props.value}
                options={markdownOptions}
            />
        </div>
    );
};

export default AppsFormHeader;
