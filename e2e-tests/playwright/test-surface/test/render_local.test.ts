// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {scanSource, withSource} from './helpers.ts';

test('connect-supplied props keep a literal inside a class render local visible', () => {
    const scanned = scanSource({
        'source.tsx': [
            "import React from 'react';",
            "import {connect} from 'react-redux';",
            'function ImagePreview({canDownloadFiles}: {canDownloadFiles: boolean}) {if (!canDownloadFiles) {return <span/>;} return <img data-testid="file_preview_modal.image--img"/>;}',
            'export class FilePreviewModal extends React.Component<{canDownloadFiles: boolean; loaded: boolean}> {render() {let content; if (this.props.loaded) {content = <ImagePreview canDownloadFiles={this.props.canDownloadFiles}/>;} else {content = <span/>;} return <div data-testid="file_preview_modal"><span data-testid="file_preview_modal.header--text"/>{content}</div>;}}',
            'const ConnectedPreview = connect(() => ({canDownloadFiles: true, loaded: true}))(FilePreviewModal);',
            'function openModal(descriptor: unknown) {return descriptor;}',
            'export function Opener() {return <button data-testid="preview.open--button" onClick={() => openModal({dialogType: ConnectedPreview, dialogProps: {}})}/>;}',
            'export function Usage() {return <ConnectedPreview canDownloadFiles={false} loaded={true}/>;}',
        ].join('\n'),
    }, {include: ['source.tsx'], config: {entries: ['source.tsx']}});
    assert.ok(scanned.manifest.elements.some((element) => element.template === 'file_preview_modal.image--img'));
    const family = scanned.report.families[scanned.report.scopes.file_preview_modal.family];
    assert.equal(family.parts?.image.role, 'img');
});

test('a custom connect merge function can replace a false own prop', () => {
    withSource({
        'source.tsx': [
            "import {connect} from 'react-redux';",
            'function Preview({visible}: {visible: boolean}) {return visible ? <img data-testid="merge_preview.image--img"/> : null;}',
            'const Connected = connect(null, null, () => ({visible: true}))(Preview);',
            'export function App() {return <Connected visible={false}/>;}',
        ].join('\n'),
    }, {include: ['source.tsx']}, ({root, scan, readConfig}) => {
        const config = readConfig();
        assert.ok(scan(config).manifest.elements.some((element) => element.template === 'merge_preview.image--img'));
        fs.writeFileSync(path.join(root, 'source.tsx'), fs.readFileSync(path.join(root, 'source.tsx'), 'utf8').replace('() => ({visible: true})', 'undefined'));
        assert.equal(scan(config).manifest.elements.some((element) => element.template === 'merge_preview.image--img'), false, 'an absent custom merge retains the default own-prop behavior');
    });
});

test('a defaulted component prop retains keyed rows through a render local', () => {
    withSource({
        'source.tsx': [
            'type UserProfile = {id: string}; type Props = {users: UserProfile[]; rowComponentType?: unknown; testIdScope?: string; actionProps?: unknown};',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'function UserListRow({user, testIdScope}: {user: UserProfile; testIdScope?: string}) {return <div data-testid={testIdScope ? `${testIdScope}:${user.id}--region` : undefined}><span data-testid={testIdScope ? `${testIdScope}.name--text` : undefined}/></div>;}',
            'const UserList = ({users: usersFromProps = [], rowComponentType = UserListRow, testIdScope, actionProps}: Props) => {const users = usersFromProps; const RowComponentType = rowComponentType; let content;',
            // eslint-disable-next-line no-template-curly-in-string -- fixture source
            'if (users == null) {return null;} else if (users.length > 0 && RowComponentType && actionProps) {content = users.map((user) => <RowComponentType user={user} testIdScope={testIdScope ? `${testIdScope}.user` : undefined}/>);} else {content = null;} return <section>{content}</section>;};',
            'function Searchable({users, rowComponentType, testIdScope}: Props) {return <UserList users={users} actionProps={{}} rowComponentType={rowComponentType} testIdScope={testIdScope}/>;}',
            'declare const users: UserProfile[]; export function App() {return <Searchable users={users} testIdScope="members"/>;}',
        ].join('\n'),
    }, {include: ['source.tsx']}, ({root, scan}) => {
        const scanned = scan();
        const row = scanned.manifest.elements.find((element) => element.template === 'members.user:{key}--region');
        assert.ok(row, JSON.stringify(scanned.diagnostics));
        assert.ok(row.key);
        const file = path.join(root, 'source.tsx');
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('rowComponentType={rowComponentType}', 'rowComponentType={null}'));
        const nullOverride = scan();
        assert.equal(nullOverride.manifest.elements.some((element) => element.template === 'members.user:{key}--region'), false, 'an explicit null does not activate a component default');
    });
});
