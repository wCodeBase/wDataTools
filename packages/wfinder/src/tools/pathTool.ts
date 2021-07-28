import * as path from "path";
export const isPathInclude = (absParentPath: string, absSubPath: string) =>
  path.relative(absParentPath, absSubPath).slice(0, 2) !== "..";

export const isPathEqual = (pathA: string, pathB: string) =>
  path.resolve(pathA) === path.resolve(pathB);

/**
 * @param absParentPath absolute path
 * @param pathB absolute or relative path
 */
export const joinToAbsolute = (absParentPath: string, pathB: string) => {
  if (path.isAbsolute(pathB)) return pathB;
  return path.resolve(path.join(absParentPath, pathB));
};

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
