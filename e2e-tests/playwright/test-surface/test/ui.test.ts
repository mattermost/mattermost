// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import path from 'node:path';
import {test} from 'node:test';

import {element, exact, FIXTURES, scanFixture} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

const out = () => scanFixture('ui');

// the menu-as-modal every menu trigger opens in mobile view (`menuForm`) has its own test

test('ui: the fixture yields exactly these elements', () => {
    assert.deepEqual(out().manifest.elements.map((e) => e.template).sort(), [
        'add_menu.browse--menuitem',
        'add_menu.create--menuitem',
        'add_menu_tour',
        'banner.leave--togglebutton',
        'banner.url',
        'banner.url.copy--button',
        'bar.header.open_menu--button',
        'bar.menu.one--menuitem',
        'bar.menu.two--menuitem',
        'card',
        'card.open--button',
        'field_menu.field:{key}--menuitem',
        'footer.cancel--button',
        'footer.leave--button',
        'footer.note--button',
        'footer.save--button',
        'footer.token',
        'footer.token.copy--button',
        'header.big_close--button',
        'header.close--button',
        'header.current_channel--option',
        'header.dismiss--button',
        'header.either--button',
        'header.external--link',
        'header.faq--link',
        'header.follow--button',
        'header.follow_icon--togglebutton',
        'header.guide--button',
        'header.help--link',
        'header.home--link',
        'header.info--button',
        'header.label',
        'header.lazy--button',
        'header.long_paths--button',
        'header.menu.leave--menuitem',
        'header.menu.mute--menuitem',
        'header.menu.settings--menuitem',
        'header.navigation_modal--button',
        'header.note',
        'header.off_topic--link',
        'header.open_add_menu--button',
        'header.open_field_menu--button',
        'header.open_menu--button',
        'header.open_role_menu--button',
        'header.open_sort_menu--button',
        'header.pick--button',
        'header.search--textbox',
        'header.settings--button',
        'header.status--textbox',
        'header.status_clear--button',
        'info_popover.body--text',
        'lazy_modal.ok--button',
        'leave_modal.confirm--button',
        'left.actions.action:{key}--menuitem',
        'left.actions.open--button',
        'left.picker.menu.team:{key}--menuitem',
        'left.picker.open_menu--button',
        'mention_popover.actions',
        'mention_popover.name--text',
        'menu_modal',
        'menu_modal.list',
        'note_modal',
        'note_modal.save--button',
        'right.actions.action:{key}--menuitem',
        'right.actions.open--button',
        'right.picker.menu.team:{key}--menuitem',
        'right.picker.open_menu--button',
        'role_menu.make_admin--menuitem',
        'role_menu.make_member--menuitem',
        'save_bar.confirm_modal',
        'save_bar.confirm_modal.confirm--button',
        'save_bar.refused_modal',
        'save_bar.refused_modal.confirm--button',
        'save_bar.save--button',
        'settings_modal.save--button',
        'side.info',
        'side.info.close--button',
        'side.members',
        'snippet.text--text',
        'sort_menu.field:{key}--menuitem',
        'static_items.more--button',
        'team_picker.menu.team:{key}--menuitem',
        'team_picker.open_menu--button',
        'tip.close--button',
        'toolbar.files--button',
        'toolbar.info--button',
        'twin.compact_menu.one--menuitem',
        'twin.edit--button',
        'twin.full_menu.two--menuitem',
    ]);
});

test('ui: component testids land on the element the component spreads its props onto', () => {
    assert.equal(element(out(), 'header.menu.leave--menuitem').aria.role, 'menuitem');
    assert.equal(element(out(), 'header.menu.mute--menuitem').aria.role, 'menuitemcheckbox');
    assert.equal(element(out(), 'header.lazy--button').aria.role, 'button');
    assert.equal(element(out(), 'banner.leave--togglebutton').aria.role, 'togglebutton');
});

test('ui: render conditions: &&, ternary arms, early return, useSelector explained, usage-level', () => {
    const settings = element(out(), 'header.menu.settings--menuitem').renderedWhen!;
    assert.ok(settings.some((c) => c.expr === 'canAccess' && c.explained === 'canManage(state, channelId)' && c.kind === 'permission'), JSON.stringify(settings));
    assert.ok(settings.some((c) => c.expr === 'channelId' && c.kind === 'prop'), JSON.stringify(settings));
    const info = element(out(), 'header.info--button').renderedWhen!.map((c) => c.expr);
    assert.ok(info.includes('isMobile'));
    const help = element(out(), 'header.help--link').renderedWhen!.map((c) => c.expr);
    assert.ok(help.includes('!isMobile'));
    const popover = element(out(), 'info_popover.body--text').renderedWhen!.map((c) => c.expr);
    assert.ok(popover.includes('showInfo'), JSON.stringify(popover));
});

test('ui: opened components list the scopes they render', () => {
    const c = out().manifest.components.find((x) => x.name === 'SettingsModal');
    assert.deepEqual(c?.scopes, ['settings_modal']);
});

test('ui: a component testId prop composes with the role the component appends; a passed data-testid flows through', () => {
    assert.equal(element(out(), 'footer.save--button').aria.role, 'button');
    assert.equal(element(out(), 'footer.cancel--button').aria.role, 'button');
    assert.ok(!out().result.sites.some((s) => s.kind === 'component' && s.at.includes('modals.tsx') && !s.forwarded));
});

test('ui: a page\'s ready elements come from pageReady; a scope prefix or another page\'s element is an error', () => {
    assert.deepEqual(out().manifest.pages.map((p) => [p.class, p.ready]), [['ChannelsPage', ['header.label', 'banner.url']], ['HelpPage', undefined]]);

    const config = loadConfig(path.join(FIXTURES, 'ui', 'test-surface.config.json'));
    config.pageReady = {HelpPage: ['header'], NoSuchPage: ['footer']};
    const {manifest, diagnostics} = scanProject(config);
    assert.deepEqual(diagnostics.filter((d) => d.rule === 'pages').map((d) => d.message), [
        'pageReady for HelpPage names `header`, which the page doesn\'t render as an element.',
        'pageReady names NoSuchPage, which isn\'t a page.',
    ]);
    assert.equal(manifest.pages.find((p) => p.class === 'HelpPage')?.ready, undefined);
});

test('ui: a class component reached through another class\'s static, behind a HOC, keeps its usage\'s testid', () => {
    assert.deepEqual(exact(out(), 'static_items.more--button').instances.map((i) => i.via), [['src/statics.tsx:31:13']]);
});

test('ui: a styled-components tag has the role of the element it renders', () => {
    assert.equal(element(out(), 'header.close--button').aria.role, 'button');
    assert.ok(!out().diagnostics.some((d) => d.message.includes('header.close--button')));
});

test('ui: styled(StyledTag) keeps the inner element; styled(Component) passes the usage props to the component', () => {
    assert.equal(element(out(), 'header.big_close--button').aria.role, 'button');
    assert.deepEqual(exact(out(), 'header.note').instances.map((i) => i.via), [['src/menu.tsx:176:13']]);
    assert.ok(!out().diagnostics.some((d) => d.message.includes('big_close') || d.message.includes('header.note')), JSON.stringify(out().diagnostics.filter((d) => d.at.includes('menu.tsx'))));
});

test('ui: a styled tag rendered `as` another element takes that element\'s role for each usage', () => {
    assert.equal(element(out(), 'header.pick--button').aria.role, 'button');
    assert.equal(element(out(), 'header.label').aria.role, null);
    assert.ok(!out().diagnostics.some((d) => d.message.includes('header.pick--button') || d.message.includes('header.label')), JSON.stringify(out().diagnostics.filter((d) => d.message.includes('header.'))));
});

test('ui: an element rendered at several sites keeps only the conditions every site shares', () => {
    const close = element(out(), 'header.dismiss--button').renderedWhen!.map((c) => c.expr);
    assert.deepEqual(close, ['open'], JSON.stringify(close));
});

test('ui: an early return on a prop (with a default) decides which element each instance renders', () => {
    const templates = out().manifest.elements.map((e) => e.template).filter((t) => t.startsWith('header.follow'));
    assert.deepEqual(templates.sort(), ['header.follow--button', 'header.follow_icon--togglebutton']);
});

test('ui: props spread through createElement(component || \'input\') land on an input', () => {
    const e = element(out(), 'header.search--textbox');
    assert.deepEqual({role: e.aria.role, native: e.aria.native}, {role: 'textbox', native: true});
    assert.ok(!out().diagnostics.some((d) => d.rule === 'role-fit' && d.message.includes('header.search--textbox')));
});

test('ui: a testid passed through forwardRef, memo and createElement(inputComponent) lands on the input, beside another testid prop of the same usage', () => {
    assert.equal(element(out(), 'header.status--textbox').aria.role, 'textbox');
    assert.equal(element(out(), 'header.status_clear--button').aria.role, 'button');
});

test('ui: reported pages retain rendered scopes and configured route parameter bindings', () => {
    const report = out().report;
    const page = report.pages.ChannelsPage;
    assert.ok(page.scopes.includes('header'));
    assert.ok(page.scopes.every((scope) => scope in report.scopes));
    assert.deepEqual(page.params?.find((param) => param.name === 'identifier'), {
        name: 'identifier', as: 'channel', entity: {type: 'Channel', field: 'name', from: '@mattermost/types/channels'},
    });
    assert.deepEqual(page.params?.find((param) => param.name === 'path')?.values, ['channels', 'messages']);
    assert.equal(page.params?.find((param) => param.name === 'postid')?.optional, true);
    assert.deepEqual(page.ready, ['header.label', 'banner.url']);
});
