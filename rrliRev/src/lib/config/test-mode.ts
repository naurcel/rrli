export const isTestRunner: boolean =
  typeof process !== "undefined" &&
  (process.env.NODE_ENV === "test" ||
    process.env.npm_lifecycle_event === "test" ||
    (Array.isArray(process.execArgv) && process.execArgv.includes("--test")) ||
    (Array.isArray(process.argv) &&
      process.argv.some((a) => a.includes(".test.") || a.includes("test"))));
