import React, { useCallback, useState } from "react";
import Input from "ink-text-input";
import { defaultPropsFc } from "../../tools/fc";
import { Box, Text, useFocus, useInput } from "ink";
import { useStableState } from "../../hooks/hooks";
import { useCliEscape } from "../consoleHooks/useCliKeyPress";

export const CmdInput = defaultPropsFc({
    label: '', placeholder: "Type text here",
    initialValue: '',
    onSubmit: (value:string)=>{},
}, (props) => {
    const [state, setState] = useStableState(()=>({input:props.initialValue}));
    const setInput = useCallback((input:string)=>setState({input}),[])
    useCliEscape(()=>{
        if(state.input) {
            setState({input:''});
            return true;
        }
    },[]);
    return <Box>
        {!!props.label && <Box marginRight={1}><Text backgroundColor="blue">{props.label}:</Text></Box>}
        <Input value={state.input} onChange={setInput} placeholder={props.placeholder} onSubmit={props.onSubmit} />
    </Box>
}, true);