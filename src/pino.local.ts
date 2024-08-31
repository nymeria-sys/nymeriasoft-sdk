import pino from "pino";
import { existsSync, mkdirSync } from "fs";

export default () => {
  // Environment variables
  const { env } = process;

  const targets = [];

  if (env.LOG_FILE) {
    const cwd = env.LOG_DIR || process.cwd();
    const logPath = `${cwd}/log`;

    if (!existsSync(logPath)) {
      mkdirSync(logPath, { recursive: true });
    }
    targets.push({
      level: "trace",
      target: "pino/file",
      options: {
        destination: logPath + "/" + env.LOG_FILE,
      },
    });
  }

  if (env.LOG_CONSOLE) {
    targets.push({
      level: "trace",
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    });
  }

  const transport = pino.transport({
    targets,
  });

  return pino(
    {
      name: "nymeriasoft-sdk",
      level: env.LOG_LEVEL || "debug",
    },
    transport
  );
};
