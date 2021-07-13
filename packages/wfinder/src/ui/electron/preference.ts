import { JsonMore } from "./../../tools/json";
import fs from "fs";
import { executeUiCmd } from "../../finder/events/eventTools";
import { ConfigLineType } from "../../finder/types";
import { EvFinderReady } from "../../finder/events/events";
import { Config } from "../../finder/common";
import { TypeMsgConfigItem } from "../../finder/events/types";

const userPreference = {
  windowWidth: undefined as number | undefined,
  windowHeight: undefined as number | undefined,
  windowX: undefined as number | undefined,
  windowY: undefined as number | undefined,
  maximize: false,
  finderRoot: Config.finderRoot,
};

let preferenceConfig: TypeMsgConfigItem | undefined;

const subscribe = EvFinderReady.subscribe(async (ready) => {
  if (!ready) return;
  try {
    const info = await (
      await executeUiCmd("listConfig", {
        cmd: "listConfig",
        data: { type: ConfigLineType.userPreference },
      })
    ).result.results[0];
    if (info?.jsonStr) {
      Object.assign(
        userPreference,
        JsonMore.parse(String(fs.readFileSync(info.jsonStr)))
      );
    }
  } catch (e) {
    console.error("Faile to read user preference", String(e));
  }
});

export const getUserPreference = () => userPreference;

export const setUserPreference = async (p: Partial<typeof userPreference>) => {
  Object.assign(userPreference, p);
  try {
    if (!EvFinderReady.value) throw new Error("Finder is not ready");
    await executeUiCmd("saveOrCreateConfig", {
      cmd: "saveOrCreateConfig",
      data: {
        content: "userPreference",
        type: ConfigLineType.userPreference,
        dbInfo: Config,
        ...(preferenceConfig || {}),
        jsonStr: JsonMore.stringify(userPreference),
      },
    });
  } catch (e) {
    console.error("Faile to set user preference", String(e));
  }
};
