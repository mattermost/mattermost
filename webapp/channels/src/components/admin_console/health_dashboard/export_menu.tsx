// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {forwardRef, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {ChevronDownIcon, DownloadOutlineIcon, FilePdfOutlineIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';

import {Client4} from 'mattermost-redux/client';

import * as Menu from 'components/menu';
import type {MenuButtonComponentProps} from 'components/menu';

type Format = Parameters<typeof Client4.exportHealthFindings>[0];

const msg = defineMessages({
    button: {id: 'admin.health_dashboard.export.button', defaultMessage: 'Export'},
    exporting: {id: 'admin.health_dashboard.export.exporting', defaultMessage: 'Exporting…'},
    menuLabel: {id: 'admin.health_dashboard.export.menu_label', defaultMessage: 'Export health findings'},
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

// Revoking the object URL synchronously after click() can cancel the download in some browsers.
const REVOKE_OBJECT_URL_DELAY_MS = 40 * 1000;

function download(content: string, filename: string) {
    const href = URL.createObjectURL(new Blob([content]));
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(href), REVOKE_OBJECT_URL_DELAY_MS);
}

// The frame and the page title of the last print, cleaned up on the next one in case afterprint
// never fired.
let printFrame: HTMLIFrameElement | undefined;
let pageTitle: string | undefined;

function endPrint() {
    printFrame?.remove();
    if (pageTitle !== undefined) {
        document.title = pageTitle;
        pageTitle = undefined;
    }
}

// The report is static HTML with no scripts, so the iframe gets only what print() needs: same
// origin so this page can call print() on it, and modals so the print dialog may open.
// Chrome suggests the PDF file name from the page title, so the title is the export file name
// while printing.
function print(html: string, filename: string) {
    endPrint();
    const frame = document.createElement('iframe');
    printFrame = frame;
    frame.setAttribute('sandbox', 'allow-modals allow-same-origin');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0;';
    frame.addEventListener('load', () => {
        frame.contentWindow?.addEventListener('afterprint', endPrint);
        pageTitle = document.title;
        document.title = filename.replace(/\.[^.]*$/, '');
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

    const exportFindings = async (format: Format, save: (content: string, filename: string) => void) => {
        setExporting(true);
        onError(false);
        const result = await Client4.exportHealthFindings(format).catch(() => undefined);
        setExporting(false);
        if (result) {
            save(result.content, result.filename);
        } else {
            onError(true);
        }
    };

    return (
        <Menu.Container
            menuButton={{
                id: `${menuId}-button`,
                testId: 'admin.health.export',
                as: ExportMenuTrigger,
                disabled: exporting,

                // Both labels share one grid cell, so the button keeps the width of the
                // longer one and doesn't push Re-run checks aside while exporting.
                children: (
                    <span className='HealthDashboard__exportLabel'>
                        <span aria-hidden={exporting}>
                            <FormattedMessage {...msg.button}/>
                        </span>
                        <span aria-hidden={!exporting}>
                            <FormattedMessage {...msg.exporting}/>
                        </span>
                    </span>
                ),
            }}
            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'right'}}
            menu={{
                id: menuId,
                'aria-label': formatMessage(msg.menuLabel),
            }}
        >
            <Menu.Item
                id={`${menuId}-html`}
                data-testid='admin.health.export.html--menuitem'
                leadingElement={<DownloadOutlineIcon size={18}/>}
                labels={<FormattedMessage {...msg.html}/>}
                onClick={() => exportFindings('html', download)}
            />
            <Menu.Item
                id={`${menuId}-markdown`}
                data-testid='admin.health.export.markdown--menuitem'
                leadingElement={<DownloadOutlineIcon size={18}/>}
                labels={<FormattedMessage {...msg.markdown}/>}
                onClick={() => exportFindings('md', download)}
            />
            <Menu.Item
                id={`${menuId}-print`}
                data-testid='admin.health.export.print--menuitem'
                leadingElement={<FilePdfOutlineIcon size={18}/>}
                labels={<FormattedMessage {...msg.print}/>}
                onClick={() => exportFindings('html', print)}
            />
        </Menu.Container>
    );
};

export default ExportMenu;
