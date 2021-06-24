import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";
import {EvDatabaseInfos, EvFileInfoChange, useFinderState } from "../../../finder/events/events";
import Spinner from 'ink-spinner';
import { FinderState } from "../../../finder/events/types";
import { useBehaviorSubjectValue } from "../../hooks/hooks";

export const Header = ()=>{
    const [finderState] = useFinderState();
    const [dbInfo] = useBehaviorSubjectValue(EvDatabaseInfos);

    return <Box display="flex" flexDirection="column">
        <Box>
    <Text>WFinder state: </Text>
        <Box>
        <Text color='blueBright'>{FinderState[finderState]}</Text>
        {[FinderState.searching, FinderState.scanning].includes(finderState) && <Spinner/> }
        </Box>
        <Box marginLeft={2}>
    <Text>record count: </Text>
        <Box>
        <Text color='blueBright'>{String(dbInfo.fileInfoCount)}</Text>
        </Box>
    </Box>
    </Box>
    <Text backgroundColor="gray">Tips: use "ESC" or "CTRL+E" to clear input or go back.</Text>

    </Box>
}