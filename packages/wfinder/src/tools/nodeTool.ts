import * as path from "path";

export const exitNthTodo = () => exit("Nothing to do, program will exit now.");

export const exit = (reason: string) => {
  console.log(reason);
  process.exit();
};

export const isPathInclude = (absParentPath: string, absSubPath: string) =>
  path.relative(absParentPath, absSubPath).slice(0, 2) !== "..";

export const splitPath = (pathStr: string) => {
  const paths: string[] = [];
  let rest = pathStr;
  while (rest) {
    const parsed = path.parse(rest);
    if (!parsed.base) {
      if (rest) paths.unshift(rest);
      break;
    }
    paths.unshift(parsed.base);
    rest = parsed.dir;
  }
  return paths;
};
