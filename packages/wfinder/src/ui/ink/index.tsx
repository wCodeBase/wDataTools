import React from 'react';
import {Text, render} from 'ink';
import { CmdInput } from './components/CmdInput';
import { Header } from './blocks/Header';
import { Body } from './blocks/Body';
import {InkConsole} from './blocks/Console';
import { exitCallbacks } from './exit';

export const Ui = ()=>{
    return <>
        <Header/>
        <InkConsole/>
        <Body/>
    </>
}

export const renderInkUi = ()=>{
    const handler = render(<Ui/>);
    exitCallbacks.push(async ()=>{
        handler.clear();
    });
    return handler;
}