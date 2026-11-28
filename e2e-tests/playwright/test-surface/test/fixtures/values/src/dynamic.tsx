import React from 'react';
import {connect} from 'react-redux';

import type {Channel} from '../types/channels';
import type {FileInfo} from '../types/files';

function Label({testId}: {testId: string}) {
    return <span data-testid={`${testId}--text`}/>;
}

function Plain({testId}: {testId: string}) {
    return <input data-testid={`${testId}.plain--textbox`}/>;
}

function Rich({testId}: {testId: string}) {
    return <div data-testid={`${testId}.rich--textbox`} role='textbox'/>;
}

// React.createElement with a props object
export function Created() {
    return React.createElement(Label, {testId: 'values.dynamic.created'});
}

// a tag held in a variable: each candidate component gets the usage's props
export function Editor({rich}: {rich: boolean}) {
    const Input = rich ? Rich : Plain;
    return <Input testId='values.dynamic.editor'/>;
}

// createElement with a component chosen from props
export function Slot({component}: {component: typeof Label}) {
    return React.createElement(component, {testId: 'values.dynamic.slot'});
}

export function SlotUser() {
    return <Slot component={Label}/>;
}

// two testids that would generate the same member name in one class
export function Colliding() {
    return (
        <div>
            <button data-testid='values.colliding.save--button'/>
            <span data-testid='values.colliding.save_button.hint--text'/>
        </div>
    );
}

// connect(): a prop its maps visibly don't return is missing at a usage that doesn't pass it
function TabsInner(props: {scope?: string; extra?: string[]; mobile: boolean}) {
    return <div data-testid={props.extra ? `${props.scope}.with_extra` : `${props.scope}.plain`}/>;
}
const ConnectedTabs = connect(() => ({mobile: false}))(TabsInner);
export function TabsUsers() {
    return (
        <div>
            <ConnectedTabs scope='values.connected_a'/>
            <ConnectedTabs
                scope='values.connected_b'
                extra={['x']}
            />
        </div>
    );
}

// an entity found in a list (`Channel | undefined`, narrowed): the key is still the entity's field
export function Found({channels, id}: {channels: Channel[]; id: string}) {
    const found = channels.find((c) => c.id === id);
    if (!found) {
        return null;
    }
    return (
        <a
            href='#'
            data-testid={`values.found.channel:${found.name}--link`}
        />
    );
}

// a local intersection with an entity (`FileInfo & {percent, id}`): the key is the field of the entity that declares it, even where a local type declares it too
type Preview = FileInfo & {percent?: number; id: string};
export function Previews({previews}: {previews: Preview[]}) {
    return (
        <div>
            {previews.map((p) => (
                <div
                    key={p.id}
                    data-testid={`values.previews.file:${p.id}`}
                />
            ))}
        </div>
    );
}

// a list of mixed items, read through a cast in the row: the cast types the key
type LocalDraft = {channelId: string};
function MixedRow({item}: {item: LocalDraft | Channel}) {
    return (
        <a
            href='#'
            data-testid={`values.mixed.channel:${(item as Channel).name}--link`}
        />
    );
}
export function Mixed({items}: {items: Array<LocalDraft | Channel>}) {
    return <div>{items.map((it) => <MixedRow item={it}/>)}</div>;
}

// two ternaries on one condition pair up arm by arm, never crosswise
export function Paired({item}: {item: {at?: number; n: number}}) {
    const scheduled = 'at' in item;
    const inverted = item.n > 1;
    const scope = scheduled ? 'values.paired.scheduled' : 'values.paired.draft';
    const key = scheduled ? 'sched' : 'drft';
    const other = !inverted ? 'a' : 'b';
    const flipped = inverted ? 'x' : 'y';
    return (
        <div>
            <a
                href='#'
                data-testid={`${scope}:${key}--link`}
            />
            <span data-testid={`values.paired.${other}_${flipped}--text`}/>
        </div>
    );
}

// a scope threaded through six components, each adding a segment behind a condition
function ChainLeaf({s}: {s?: string}) {
    return <b data-testid={s ? `${s}.leaf--text` : undefined}/>;
}
function ChainE({s}: {s?: string}) {
    return <ChainLeaf s={s ? `${s}.e` : undefined}/>;
}
function ChainD({s}: {s?: string}) {
    return <ChainE s={s ? `${s}.d` : undefined}/>;
}
function ChainC({s}: {s?: string}) {
    return <ChainD s={s ? `${s}.c` : undefined}/>;
}
function ChainB({s}: {s?: string}) {
    return <ChainC s={s ? `${s}.b` : undefined}/>;
}
function ChainA({s}: {s?: string}) {
    return <ChainB s={s ? `${s}.a` : undefined}/>;
}
export function Chain() {
    return <ChainA s='values.chain'/>;
}

// narrowing: in `testId ? `${testId}--button` : undefined`, testId is set in the true branch
function NarrowButton({testId}: {testId?: string}) {
    return <button data-testid={testId ? `${testId}--button` : undefined}/>;
}
export function NarrowList({options, scope}: {options: Array<{plugin?: string}>; scope?: string}) {
    return (
        <div>
            {options.map((o) => (
                <NarrowButton
                    key={o.plugin}
                    testId={scope && o.plugin ? `${scope}.plugin:${o.plugin}` : undefined}
                />
            ))}
        </div>
    );
}
// a nullish comparison narrows too (`0` is a set index)
function NarrowSection({index}: {index?: number}) {
    return <div data-testid={index === undefined ? undefined : `values.narrow.section:${index}`}/>;
}
export function NarrowSections() {
    return (
        <div>
            <NarrowSection index={0}/>
            <NarrowSection/>
        </div>
    );
}

export function NarrowUsers() {
    return (
        <div>
            <NarrowList
                options={[]}
                scope='values.narrow'
            />
            <NarrowList options={[]}/>
        </div>
    );
}

// `scope && key ? \`${scope}:${key}\` : scope`: an instance without a key takes the bare scope only
function Keyed({scope, keyed}: {scope?: string; keyed?: string}) {
    return <i data-testid={scope && keyed ? `${scope}:${keyed}` : scope}/>;
}
export function KeyedUses() {
    return (
        <div>
            <Keyed scope='values.keyed.plain'/>
            <Keyed
                scope='values.keyed.item'
                keyed='one'
            />
        </div>
    );
}

// an enum with an empty member, keyed with a fallback for it: '' takes 'none'
export enum Clear {
    NEVER = '',
    HOUR = 'hour',
    DAY = 'day',
}

export function ClearOptions({options}: {options: Clear[]}) {
    return (
        <div>
            {options.map((o) => (
                <button
                    key={o}
                    data-testid={`values.clear.option:${o || 'none'}--button`}
                />
            ))}
        </div>
    );
}

// a component from a typed definition, rendered by a method called through a lookup table (System Console custom
// settings): the definitions of that type that set the member are the candidates, so a prop default shows
type CustomDefinition = {type: 'custom'; component: React.ComponentType<{id: string}>};

function DefinedPanel({id, testIdScope = 'values.defined'}: {id: string; testIdScope?: string}) {
    return <span data-testid={`${testIdScope}.panel:${id}--text`}/>;
}

export const DEFINITIONS: CustomDefinition[] = [{type: 'custom', component: DefinedPanel}];

export class DefinitionRenderer extends React.Component<{definitions: CustomDefinition[]}> {
    renderCustom = (definition: CustomDefinition) => {
        const Custom = definition.component;
        return <Custom id='only'/>;
    };

    renderers: Record<string, (definition: CustomDefinition) => React.ReactNode> = {custom: this.renderCustom};

    render() {
        return this.props.definitions.map((d) => this.renderers[d.type](d));
    }
}
