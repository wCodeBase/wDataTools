import { Config } from "../../finder/common";
import { EvFinderReady, EvUiCmd } from "../../finder/events/events";
import { executeUiCmd } from "../../finder/events/eventTools";
import { TypeMsgConfigItem } from "../../finder/events/types";
import { ConfigLineType } from "../../finder/types";
import { JsonMore } from "wjstools";

const userPreference = {
  windowWidth: undefined as number | undefined,
  windowHeight: undefined as number | undefined,
  windowX: undefined as number | undefined,
  windowY: undefined as number | undefined,
  maximize: false,
  finderRoot: Config.finderRoot,
};

let preferenceConfig: TypeMsgConfigItem | undefined;
let preferenceResolves: ((v: typeof userPreference) => void)[] = [];

EvFinderReady.subscribe(async (ready) => {
  if (!ready) return;
  try {
    const info = await (
      await executeUiCmd("listConfig", {
        cmd: "listConfig",
        data: { type: ConfigLineType.userPreference },
      })
    ).result.results[0];
    if (info?.jsonStr) {
      Object.assign(userPreference, JsonMore.parse(info.jsonStr));
    }
    preferenceResolves.forEach((r) => r(userPreference));
    preferenceResolves = [];
  } catch (e) {
    console.error("Faile to read user preference", String(e));
  }
});

EvUiCmd.subscribe((msg) => {
  if (msg?.cmd === "requestChooseFinderRoot") {
    preferenceResolves.forEach((r) => r(userPreference));
    preferenceResolves = [];
  }
});

export const getUserPreference = () =>
  EvFinderReady.value
    ? userPreference
    : new Promise<typeof userPreference>((res) => preferenceResolves.push(res));

export const setUserPreference = async (p: Partial<typeof userPreference>) => {
  Object.assign(userPreference, p);
  try {
    if (!EvFinderReady.value) throw new Error("Finder is not ready");
    await executeUiCmd("saveOrCreateConfig", {
      cmd: "saveOrCreateConfig",
      data: {
        content: "userPreference",
        type: ConfigLineType.userPreference,
        ...(preferenceConfig || {}),
        jsonStr: JsonMore.stringify(userPreference),
      },
    });
  } catch (e) {
    console.error("Faile to set user preference", String(e));
  }
};
