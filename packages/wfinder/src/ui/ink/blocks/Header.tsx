import { Box, Text } from "ink";
import React from "react";
import {
  EvDatabaseInfos,
  useFinderStatus,
} from "../../../finder/events/events";
import Spinner from "ink-spinner";
import { FinderStatus } from "../../../finder/events/types";
import { useBehaviorSubjectValue } from "wjstools";

export const Header = () => {
  const [finderStatus] = useFinderStatus();
  const [dbInfo] = useBehaviorSubjectValue(EvDatabaseInfos);

  return (
    <Box display="flex" flexDirection="column">
      <Box>
        <Text>WFinder state: </Text>
        <Box>
          <Text color="blueBright">{FinderStatus[finderStatus.status]}</Text>
          {[FinderStatus.searching, FinderStatus.scanning].includes(
            finderStatus.status
          ) && <Spinner />}
        </Box>
        <Box marginLeft={2}>
          <Text>file count: </Text>
          <Box>
            <Text color="blueBright">{String(dbInfo.totalFileInfoCount)}</Text>
          </Box>
        </Box>
      </Box>
      <Text backgroundColor="gray">
        Tips: use "ESC" or "CTRL+E" to clear input or go back.
      </Text>
    </Box>
  );
};
