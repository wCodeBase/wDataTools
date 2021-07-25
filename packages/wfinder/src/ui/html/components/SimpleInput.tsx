import { defaultPropsFc } from "./../../tools/fc";
import React, { useMemo } from "react";
import { CloseOutlined } from "@ant-design/icons";
import { Input, InputProps } from "antd";
import { useState } from "react";
import { useStableState } from "../../hooks/hooks";

export const SimpleInput = defaultPropsFc(
  {
    ...({} as Omit<InputProps, "onPressEnter" | "value" | "onChange">),
    onSubmit: undefined as undefined | ((val: string) => Promise<boolean>),
  },
  (props) => {
    const [state, setState] = useStableState(() => ({
      input: "",
      onChange: ((ev) => {
        setState({ input: ev.target.value });
      }) as React.ChangeEventHandler<HTMLInputElement>,
      onEnter: () => {
        props.onSubmit?.(state.input).then((res) => {
          if (res) setState({ input: "" });
        });
      },
    }));
    const inputProps = useMemo(() => {
      const { onSubmit, ...rest } = props;
      return rest;
    }, [props]);
    return (
      <Input
        {...inputProps}
        value={state.input}
        onChange={state.onChange}
        onPressEnter={state.onEnter}
      />
    );
  },
  true
);
