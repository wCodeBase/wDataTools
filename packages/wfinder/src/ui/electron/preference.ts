import { JsonMore } from "./../../tools/json";
import { app } from "electron";
import path from "path";
import fs from "fs";

const USER_PREFERNECE_FILE = path.join(
  app.getPath("userData"),
  "userPreference.json"
);
const userPreference = {
  windowWidth: undefined as number | undefined,
  windowHeight: undefined as number | undefined,
  windowX: undefined as number | undefined,
  windowY: undefined as number | undefined,
  maximize: false,
};

try {
  if (fs.existsSync(USER_PREFERNECE_FILE)) {
    Object.assign(
      userPreference,
      JsonMore.parse(String(fs.readFileSync(USER_PREFERNECE_FILE)))
    );
  }
} catch (e) {
  console.error("Faile to read user preference", String(e));
}

export const getUserPreference = () => userPreference;

export const setUserPreference = (p: Partial<typeof userPreference>) => {
  Object.assign(userPreference, p);
  try {
    fs.writeFileSync(USER_PREFERNECE_FILE, JsonMore.stringify(userPreference));
  } catch (e) {
    console.error("Faile to set user preference", String(e));
  }
};
