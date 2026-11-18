import React, {useMemo} from 'react';

import * as constants from './constants';
import {Deep, Leaf, Panel, Wrapper} from './leaf';
import type {Channel} from '../types/channels';

function helper(name: string) {
    return `values.helper.${name}--button`;
}

export function App({channel}: {channel: Channel}) {
    const memoId = useMemo(() => 'values.memo.item--text', []);
    const local = {testId: 'values.spread.local--button'};
    let lid = 'values.let.first--text';
    if (channel.id) {
        lid = 'values.let.second--text';
    }
    const tabs = [{name: 'info'}, {name: 'members'}];
    return (
        <div>
            <Leaf testId='values.leaf.given--button'/>
            <Leaf/>
            <Leaf {...local}/>
            <Wrapper
                label='x'
                testId='values.wrapper.inner--button'
            />
            <Deep ids={{main: 'values.deep.main--text'}}/>
            <Panel prefix='values.panel'/>
            <span data-testid={memoId}/>
            <span data-testid={lid}/>
            <button data-testid={constants.TestIds.nested.save}/>
            <button data-testid={helper('go')}/>
            {tabs.map((tab) => (
                <a
                    key={tab.name}
                    href='#'
                    data-testid={`values.tabs.tab:${tab.name}--link`}
                />
            ))}
            <a
                href='#'
                data-testid={`values.channels.channel:${channel.name}--link`}
            >
                <span data-testid='values.channels.channel.unread_count--text'/>
                <span data-testid='values.channels.channel.draft--text'/>
            </a>
            <span data-testid={`values.channel.${channel.display_name}`}/>
            {[channel, channel].map((c, i) => (
                <Row
                    key={c.id}
                    index={i}
                />
            ))}
        </div>
    );
}

function Row({index}: {index: number}) {
    return <span data-testid={`values.rows.row:${index}--text`}/>;
}

// method parameter: resolved at every call site
class Builder {
    id(kind: string) {
        return <span data-testid={`values.builder.${kind}--text`}/>;
    }
    all() {
        return [this.id('a'), this.id('b')];
    }
}
export const builder = new Builder();

// a helper taking an options object: the path into each call's argument
type SectionOpts = {first: {value: string}; second: {value: string}; third?: {value: string}};
class Sections {
    section(opts: SectionOpts) {
        const {first, second, third} = opts;
        return (
            <div>
                <input
                    type='radio'
                    data-testid={`values.sections.option:${first.value}--radio`}
                />
                <input
                    type='radio'
                    data-testid={`values.sections.option:${second.value}--radio`}
                />
                {third && (
                    <input
                        type='radio'
                        data-testid={`values.sections.option:${third.value}--radio`}
                    />
                )}
            </div>
        );
    }
    all() {
        return [this.section({first: {value: 'compact'}, second: {value: 'full'}}), this.section({first: {value: 'on'}, second: {value: 'off'}, third: {value: 'auto'}})];
    }
}
export const sections = new Sections();

// a fixed list destructured in the callback: each item's field
export function Choices() {
    const choices = [{choice: 'yes', label: 'Yes'}, {choice: 'no', label: 'No'}];
    return (
        <div>
            {choices.map(({choice, label}) => (
                <input
                    key={choice}
                    type='radio'
                    aria-label={label}
                    data-testid={`values.choices.choice:${choice}--radio`}
                />
            ))}
        </div>
    );
}
