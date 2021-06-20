import { useEffect } from 'react';

/**
 * @returns return true to consume current escape event.
 */
export type OnCliEscape = () => boolean | undefined;

/**
 * @returns return true to consume current escape event.
 */
export type OnCliKeyPress = (key: string) => boolean | undefined;

export const KEY_ESCAPE = String(Buffer.from([27]));
export const KEY_ARROW_UP = String(Buffer.from([27, 91,65]));
export const KEY_ARROW_DOWN = String(Buffer.from([27, 91,66]));
export const KEY_PAGE_UP = String(Buffer.from([27, 91, 53, 126]));
export const KEY_PAGE_DOWN = String(Buffer.from([27, 91, 54, 126]));
export const KEY_HOME = String(Buffer.from([27, 91, 72]));
export const KEY_END = String(Buffer.from([27, 91, 70]));

export const CLI_KEYS = [KEY_ESCAPE, KEY_ARROW_UP, KEY_ARROW_DOWN, KEY_PAGE_UP, KEY_PAGE_DOWN, KEY_HOME, KEY_END];

export const CliKeySet = new Set(CLI_KEYS);

const { useCliEscape, useCliKeyPress,triggerCliKeyCallback } = (() => {
    let escapeCbs: OnCliEscape[] = [];
    let keyCbs: OnCliKeyPress[] = [];
    const onStdinData = (chunk:Buffer|string) => {
        // console.log("key", Array.prototype.map.call(chunk, (v => v.charCodeAt(0))));
        const key = String(chunk);
        if (key === KEY_ESCAPE)
            // Use setTimeout to delay callbacks execution to avoid React state update conflict with "ink-text-input"
            setTimeout(() => escapeCbs.some(cb => cb()));
        if (CliKeySet.has(key))
            // Use setTimeout to delay callbacks execution to avoid React state update conflict with "ink-text-input"
            setTimeout(() => keyCbs.some(cb => cb(key)));
    }
    process.stdin.on('data', onStdinData);
    return {
        useCliEscape: (cb: OnCliEscape, deps: any[] = []) => {
            useEffect(() => {
                escapeCbs.unshift(cb);
                return () => { escapeCbs = escapeCbs.filter(v => v !== cb); }
            }, deps);
        },
        useCliKeyPress: (cb: OnCliKeyPress, deps: any[] = []) => {
            useEffect(() => {
                keyCbs.unshift(cb);
                return () => { keyCbs = keyCbs.filter(v => v !== cb); }
            }, deps);
        },
        triggerCliKeyCallback: onStdinData,
    }
})();

export { useCliEscape, useCliKeyPress,triggerCliKeyCallback };