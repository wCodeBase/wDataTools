import { Box, Text, useInput } from 'ink';
import React from 'react';
import { EvLog } from '../../../finder/events/events';
import { useStableState } from '../../hooks/hooks';

export type TypeSelectOption<T> = { label: string, value: T };

export const HorizontalSelect = <T extends unknown>(props: {
    options: TypeSelectOption<T>[],
    onSelect: (value: T) => void,
    label?: string,
    danger?: boolean,
    oneLine?: boolean,
    defaultSelected?: T,
    autoSelectFirstOption?: boolean,
}) => {

    const [state, setState] = useStableState(() => ({
        selected: props.options.find(v => v.value === props.defaultSelected)
            || props.autoSelectFirstOption ? props.options[0] : undefined
    }))

    useInput((val, key) => {
        if (key.tab || key.rightArrow || key.leftArrow || key.return) {
            let optionIndex = state.selected ? props.options.findIndex(v => v.value === state.selected?.value) : -1;
            if (key.return) {
                if (!state.selected || optionIndex < 0) {
                    EvLog("Warn: no option selected yet.");
                    return;
                }
                props.onSelect(state.selected.value);
            } else {
                if (key.tab || key.rightArrow) {
                    optionIndex = Math.min(optionIndex + 1, props.options.length - 1);
                } else {
                    optionIndex = Math.max(0, optionIndex - 1);
                }
                setState({ selected: props.options[optionIndex] });
            }
        }
    })

    return <Box display='flex' flexDirection={props.oneLine ? 'row' : 'column'}>
        {!!props.label && <Text color={props.danger ? 'yellow' : 'blue'}>{props.label}</Text>}
        <Box marginLeft={2}>
            {props.options.map(op => <Box key={op.value + ''} marginRight={2}><Text backgroundColor={op.value === state.selected?.value ? 'blue' : ''}>{op.label}</Text></Box>)}
        </Box></Box>
}