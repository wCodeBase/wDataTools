import React, { useCallback, useEffect } from "react";
import { Text } from "ink";
import SelectInput from "ink-select-input";
import { HorizontalSelect } from "./HorizontalSelect";

const items = ["Yes", "No"].map((v, i) => ({ label: v, value: !i }));

export let confirmShow = false;

export const Confirm = (props: {
  message: string;
  danger?: boolean;
  horizontal?: boolean;
  onSelect: (confirm: boolean) => void;
}) => {
  useEffect(() => {
    confirmShow = true;
    return () => {
      confirmShow = false;
    };
  }, []);
  const onSelect = useCallback(
    (item: { value: boolean }) => props.onSelect(item.value),
    []
  );
  if (props.horizontal)
    return (
      <HorizontalSelect
        label={props.message}
        {...props}
        options={items}
        defaultSelected={!props.danger}
      />
    );
  return (
    <>
      <Text backgroundColor={props.danger ? "red" : "blue"}>
        {props.message}:{" "}
      </Text>
      <SelectInput items={items} onSelect={onSelect} />
    </>
  );
};
