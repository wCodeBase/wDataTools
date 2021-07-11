import { BehaviorSubject } from "rxjs";

export enum WebEventStatus {
  none,
  connecting,
  connected,
  failed,
  broken,
}

export const wEvEventStatus = new BehaviorSubject<WebEventStatus>(
  WebEventStatus.none
);
