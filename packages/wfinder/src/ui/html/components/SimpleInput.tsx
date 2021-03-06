import { Input, InputProps } from "antd";
import React, { useMemo } from "react";
import { useStableState } from "../../hooks/hooks";
import { defaultPropsFc } from "./../../tools/fc";

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
      <span className="min-w-20">
        <Input
          {...inputProps}
          value={state.input}
          onChange={state.onChange}
          onPressEnter={state.onEnter}
        />
      </span>
    );
  },
  true
);
