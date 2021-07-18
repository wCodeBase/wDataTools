import Modal, { ModalProps } from "antd/lib/modal/Modal";
import React, { useEffect } from "react";
import { ReactNode } from "react";
import ReactDOM from "react-dom";
import { useStableState, useUpdate } from "../hooks/hooks";

export type TypeShowModalHandle = {
  update: () => void;
  destory: () => void;
};

export const showModal = (
  getProps: () => Omit<ModalProps, "visible"> & { render: () => ReactNode }
): TypeShowModalHandle => {
  const root = document.createElement("div");
  document.body.appendChild(root);
  let update = () => {
    void 0;
  };
  let close = () => {
    void 0;
  };
  const Item = () => {
    update = useUpdate();
    const [state, setState] = useStableState(() => ({ visible: true }));
    useEffect(() => {
      close = () => setState({ visible: false });
    }, [setState]);

    useEffect(() => {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }, []);
    const props = getProps();
    return (
      <div>
        <Modal {...props} visible={state.visible}>
          {props.render()}
        </Modal>
      </div>
    );
  };
  ReactDOM.render(<Item />, root);
  return {
    update,
    destory: () => {
      close();
      setTimeout(() => {
        ReactDOM.unmountComponentAtNode(root);
        document.body.removeChild(root);
      }, 3000);
    },
  };
};
