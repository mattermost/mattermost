// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useCallback, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {ChevronDownIcon, DownloadOutlineIcon, FilePdfOutlineIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';

import {Client4} from 'mattermost-redux/client';

import * as Menu from 'components/menu';
import type {MenuButtonComponentProps} from 'components/menu';

type Format = 'html' | 'md';

const msg = defineMessages({
    button: {id: 'admin.health_dashboard.export.button', defaultMessage: 'Export'},
    exporting: {id: 'admin.health_dashboard.export.exporting', defaultMessage: 'Exporting…'},
    menuLabel: {id: 'admin.health_dashboard.export.menu_label', defaultMessage: 'Export health findings'},
    help: {id: 'admin.health_dashboard.export.help', defaultMessage: 'Includes all findings, including muted and resolved ones.'},
    html: {id: 'admin.health_dashboard.export.html', defaultMessage: 'Download HTML'},
    markdown: {id: 'admin.health_dashboard.export.markdown', defaultMessage: 'Download Markdown'},
    print: {id: 'admin.health_dashboard.export.print', defaultMessage: 'Print / Save as PDF'},
});

const menuId = 'healthDashboardExportMenu';

const ExportMenuTrigger = forwardRef<HTMLButtonElement, MenuButtonComponentProps>(({children, ...props}, ref) => (
    <Button
        {...props}
        ref={ref}
        emphasis='secondary'
        size='small'
        trailingIcon={<Icon glyph={<ChevronDownIcon/>}/>}
    >
        {children}
    </Button>
));
ExportMenuTrigger.displayName = 'ExportMenuTrigger';

function download(content: string, filename: string, type: string) {
    const href = URL.createObjectURL(new Blob([content], {type}));
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
}

// The report is static HTML with no scripts, so the iframe gets only what print() needs: same
// origin so this page can call print() on it, and modals so the print dialog may open.
function print(html: string) {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-modals allow-same-origin');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0;';
    frame.addEventListener('load', () => {
        frame.contentWindow?.addEventListener('afterprint', () => frame.remove());
        frame.contentWindow?.print();
    }, {once: true});
    frame.srcdoc = html;
    document.body.appendChild(frame);
}

type Props = {
    onError: (failed: boolean) => void;
};

const ExportMenu = ({onError}: Props) => {
    const {formatMessage} = useIntl();
    const [exporting, setExporting] = useState(false);

    const exportFindings = useCallback(async (format: Format, save: (content: string, filename: string) => void) => {
        setExporting(true);
        onError(false);
        let result;
        try {
            result = await Client4.exportHealthFindings(format);
        } catch {
            onError(true);
        }
        setExporting(false);
        if (result) {
            save(result.content, result.filename);
        }
    }, [onError]);

    return (
        <Menu.Container
            menuButton={{
                id: `${menuId}-button`,
                dataTestId: 'healthDashboardExportButton',
                as: ExportMenuTrigger,
                disabled: exporting,
                children: <FormattedMessage {...(exporting ? msg.exporting : msg.button)}/>,
            }}
            menu={{
                id: menuId,
                'aria-label': formatMessage(msg.menuLabel),
            }}
            menuHeader={
                <p className='HealthDashboard__exportHelp'>
                    <FormattedMessage {...msg.help}/>
                </p>
            }
        >
            <Menu.Item
                id={`${menuId}-html`}
                leadingElement={<DownloadOutlineIcon size={18}/>}
                labels={<FormattedMessage {...msg.html}/>}
                onClick={() => exportFindings('html', (content, filename) => download(content, filename, 'text/html'))}
            />
            <Menu.Item
                id={`${menuId}-markdown`}
                leadingElement={<DownloadOutlineIcon size={18}/>}
                labels={<FormattedMessage {...msg.markdown}/>}
                onClick={() => exportFindings('md', (content, filename) => download(content, filename, 'text/markdown'))}
            />
            <Menu.Item
                id={`${menuId}-print`}
                leadingElement={<FilePdfOutlineIcon size={18}/>}
                labels={<FormattedMessage {...msg.print}/>}
                onClick={() => exportFindings('html', print)}
            />
        </Menu.Container>
    );
};

export default ExportMenu;
