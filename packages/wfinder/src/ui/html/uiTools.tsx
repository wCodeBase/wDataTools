import { message } from "antd";
import { TypeUiMsgResult } from "../../finder/events/types";

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
