import React from 'react';
import type {Channel, PluginManifest} from '../types/entities';

function Row({testId}: {testId?: string}) {
    return <div data-testid={testId ? `${testId}.name--text` : undefined}/>;
}
export function Keys({channel, plugin, text, one, two, choice}: {channel: Channel; plugin: PluginManifest; text: string; one: number; two: number; choice: 'my--button' | 'other'}) {
    return <>
        <div data-testid={`keys.id:${channel.id}`}/>
        <div data-testid={`keys.name:${channel.name}--text`}/>
        <div data-testid={`keys.raw:${text}`}/>
        <div data-testid={`keys.typed_raw:${text}--text`}/>
        <div data-testid={`keys.plugin:${plugin.id}--region`} role='region'/>
        <div data-testid={`keys.bare_plugin:${plugin.id}`}/>
        <div data-testid={`keys.composite:${one}-${two}--text`}/>
        <div data-testid={`keys.ambiguous:${choice}`}/>
        <Row testId={`keys.row:${channel.id}`}/>
    </>;
}
