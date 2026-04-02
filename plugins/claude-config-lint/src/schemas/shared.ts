import { z } from "zod";

/** kebab-case identifier: lowercase letters/digits separated by hyphens */
export const kebabCase = z
  .string()
  .regex(
    /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/,
    "Must be kebab-case (e.g. my-plugin)"
  );

/** Semver string: major.minor.patch with optional pre-release suffix */
export const semver = z
  .string()
  .regex(/^\d+\.\d+\.\d+(-[\w.]+)?$/, "Must be valid semver (e.g. 1.0.0)");

/** Relative path starting with ./ */
export const relativePath = z
  .string()
  .regex(/^\.\//, "Must be a relative path starting with ./");

/** Author: name required, email and url optional */
export const authorSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  url: z.string().url().optional(),
});

/** Accept a string or an array of strings */
export const stringOrArray = z.union([z.string(), z.array(z.string())]);
