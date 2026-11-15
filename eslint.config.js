import { recommended } from "@dbaida/eslint-config";

export default [
  ...recommended,
  {
    ignores: ["tests/*.mjs"],
  },
];
