import { Box, Text } from "ink";
import React from "react";
import { EvConsole } from "../../../finder/events/events";
import { useBehaviorSubjectValue, useCountDown } from "../../hooks/hooks";

export const InkConsole = () => {
  const [value, , timestamp] = useBehaviorSubjectValue(EvConsole);
  const count = useCountDown(5, [timestamp]);
  return (
    <>
      {!!value?.message && !!count && (
        <Box>
          <Text backgroundColor="blue">Console({count}):</Text>
          <Text>{" " + value.message}</Text>
        </Box>
      )}
    </>
  );
};
