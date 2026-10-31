import { z } from "zod";
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use letters, numbers and single hyphens.",
  )
  .min(3)
  .max(48);
export const identitySchema = z.object({
  name: z.string().trim().min(1).max(20),
  avatar: z.string().max(12),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  clearAvatarImage: z.boolean().optional(),
});
export const roomSchema = z
  .object({
    slug: slugSchema,
    description: z.string().max(240).default(""),
    visibility: z.enum(["public", "private"]),
    password: z.string().max(128).default(""),
    logo: z.string().min(1).max(12).default("✳"),
  })
  .refine((r) => r.visibility === "public" || r.password.length >= 8, {
    message: "Private rooms need a password of at least 8 characters.",
  });
export const messageSchema = z
  .object({
    id: z.string().uuid(),
    text: z.string().trim().max(6000).default(""),
    replyId: z.string().uuid().nullable().optional(),
    attachmentId: z.string().uuid().nullable().optional(),
  })
  .refine((m) => m.text || m.attachmentId, {
    message: "Write a message or attach a file.",
  });
