import shellJs from "shelljs";
import colors from "colors";

const dockerName = "build-wfinder";
const exec = (
  cmd: string,
  shelljsSilent = true,
  output = true,
  desc?: string
) => {
  if (output) console.warn(colors.cyan(`Run command: ${cmd}`));
  const res = shellJs.exec(cmd, { silent: shelljsSilent });
  if (res.stderr) {
    console.log(
      colors.red(`Error: Faile to ${desc || `exec ${cmd}`}:\n` + res.stderr)
    );
    process.exit(1);
  }
  if (shelljsSilent && output) console.log(colors.gray(`Got: ${res.stdout}`));
  return res.stdout;
};

if (!exec(`docker ps -aqf 'name=${dockerName}'`)) {
  exec(
    `docker run  -td \
     --name ${dockerName} \
     --env-file <(env | grep -iE 'DEBUG|NODE_|ELECTRON_|YARN_|NPM_|CI|CIRCLE|TRAVIS_TAG|TRAVIS|TRAVIS_REPO_|TRAVIS_BUILD_|TRAVIS_BRANCH|TRAVIS_PULL_REQUEST_|APPVEYOR_|CSC_|GH_|GITHUB_|BT_|AWS_|STRIP|BUILD_') \
     --env ELECTRON_CACHE="/root/.cache/electron" \
     --env ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder" \
     -v \${PWD}:/project \
     -v \${PWD##*/}-node-modules:/project/node_modules \
     -v ~/.cache/electron:/root/.cache/electron \
     -v ~/.cache/electron-builder:/root/.cache/electron-builder \
     electronuserland/builder:wine`
  );
}

exec(`docker start ${dockerName}`);
try {
  exec(`yarn build`, false);
  exec(`docker exec ${dockerName} yarn`, false);
  exec(`docker exec ${dockerName} yarn dist-all`, false);
  console.log(colors.green("Build work done."));
} finally {
  exec(`docker stop ${dockerName}`);
}
