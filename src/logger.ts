const isColorSupported = process.stdout.isTTY && !process.env.NO_COLOR;

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function color(code: string, text: string): string {
  return isColorSupported ? `${code}${text}${ANSI.reset}` : text;
}

export const logger = {
  ok(msg: string) {
    console.log(`${color(ANSI.green, "[OK]")} ${msg}`);
  },

  warn(msg: string) {
    console.log(`${color(ANSI.yellow, "[WARN]")} ${msg}`);
  },

  error(msg: string) {
    console.error(`${color(ANSI.red, "[ERROR]")} ${msg}`);
  },

  info(msg: string) {
    console.log(`${color(ANSI.blue, "[INFO]")} ${msg}`);
  },

  move(msg: string) {
    console.log(`${color(ANSI.cyan, "[MOVE]")} ${msg}`);
  },

  test(msg: string) {
    console.log(`${color(ANSI.magenta, "[TEST]")} ${msg}`);
  },

  dim(msg: string) {
    console.log(color(ANSI.dim, msg));
  },

  header(msg: string) {
    console.log(`\n${color(ANSI.bold, msg)}`);
    console.log(color(ANSI.dim, "-------------------------"));
  },
};
