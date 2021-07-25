import React from "react";

export const defaultPropsFc = <T,>(
  defaultProps: T,
  fc: React.FC<T>,
  memo = false,
  fcErrorTitle?: string
) => {
  const boundariedFc = fcErrorBoundary(fc, fcErrorTitle);
  const res: React.FC<Partial<T>> = (props) =>
    boundariedFc({ ...defaultProps, ...props });
  return memo ? React.memo(res) : res;
};

export const fcErrorBoundary = <T,>(fc: React.FC<T>, fcErrorTitle?: string) => {
  return ((props) => {
    try {
      return fc(props);
    } catch (e) {
      console.error("UI error caught by fcErrorBoundary: ", e);
      return (
        <div className="p-3 flex flex-col items-center bg-red-400 ">
          {fcErrorTitle && (
            <div className="text-ba font-bold">{fcErrorTitle}</div>
          )}
          <div className="text-lg font-bold">Failed to render UI here</div>
          <div className="text-center">{String(e)}</div>
        </div>
      );
    }
  }) as typeof fc;
};
