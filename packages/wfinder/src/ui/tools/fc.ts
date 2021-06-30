import React from "react";

export const defaultPropsFc = <T>(
  defaultProps: T,
  fc: React.FC<T>,
  memo = false
) => {
  const res = (props: Partial<T>) => fc({ ...defaultProps, ...props });
  return memo ? React.memo(res) : res;
};
