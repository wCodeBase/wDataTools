import Modal, { ModalProps } from "antd/lib/modal/Modal";
import React, { useEffect } from "react";
import { useMemo } from "react";
import { useCallback } from "react";
import { ReactNode } from "react";
import ReactDOM from "react-dom";
import { useStableState, useUpdate } from "../hooks/hooks";
import { TypeUiMsgResult } from "../../finder/events/types";
import { message } from "antd";

export type TypeShowModalHandle = {
  update: () => void;
  destory: () => void;
};

export const showModal = (
  getProps: () => Omit<ModalProps, "visible" | "onCancel"> & {
    render: () => ReactNode;
    onCancel?: () => void;
  }
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
    const props = getProps();
    const onCancel = useMemo(() => {
      close = () => {
        setState({ visible: false });
        props.onCancel?.();
      };
      return close;
    }, [props.onCancel]);

    useEffect(() => {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }, []);
    return (
      <div>
        <Modal {...props} visible={state.visible} onCancel={onCancel}>
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

export const messageError = <T extends TypeUiMsgResult>(promise: Promise<T>) =>
  promise
    .then((res) => {
      if (res.result.error) {
        message.error(res.result.error);
        return null;
      }
      return res;
    })
    .catch((e) => {
      message.error(String(e));
      return null;
    });
