import { z } from 'zod';

export const authSignupSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(6)
      .max(254)
      .email()
      .transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(128),
  })
  .strict();

export type AuthSignupSchema = typeof authSignupSchema;
export type AuthSignupParsed = z.infer<typeof authSignupSchema>;

export const authSigninSchema = authSignupSchema;
export type AuthSigninSchema = typeof authSigninSchema;
export type AuthSigninParsed = z.infer<typeof authSigninSchema>;
