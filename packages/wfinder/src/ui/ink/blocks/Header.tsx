import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";
import {useFinderState } from "../../../finder/events/events";
import Spinner from 'ink-spinner';
import { useBehaviorSubjectValue } from "../../hooks/hooks";
import { FinderState } from "../../../finder/events/types";

export const Header = ()=>{
    const [finderState] = useFinderState();
    return <Box display="flex" flexDirection="column">
        <Box>
    <Text>WFinder state: </Text>
        <Box>
        <Text color='blueBright'>{FinderState[finderState]}</Text>
        {[FinderState.searching, FinderState.scanning].includes(finderState) && <Spinner/> }
        </Box>
    </Box>
    <Text backgroundColor="gray">Tips: use "ESC" to clear input or go back.</Text>

    </Box>
}