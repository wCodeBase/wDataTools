import React, { useCallback, useEffect } from 'react';
import { Box,Text } from 'ink';
import SelectInput from 'ink-select-input';

const items = ['Yes','No'].map((v,i)=>({label:v, value:!i}));

export let confirmShow = false;

export const Confirm = (props:{message: string, danger?: boolean, onSelect: (confirm: boolean)=>void})=>{
    useEffect(()=>{
        confirmShow = true;
        return ()=>{confirmShow=false};
    },[])
    const onSelect = useCallback((item:{value:boolean})=>props.onSelect(item.value),[]);
    return <>
        <Text backgroundColor={props.danger? 'red':"blue"}>{props.message}: </Text>
        <SelectInput items={items} onSelect={onSelect}/>
    </>
}