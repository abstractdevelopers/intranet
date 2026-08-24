import { z } from "zod";

export const courseSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  description: z.string().min(1).max(500),
  type: z.enum(["COMPULSORY", "ELECTIVE"]),
  price: z.number().int().min(0),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  durationWeeks: z.number().int().min(1).max(104).optional(),
});

export const moduleSchema = z.object({
  title: z.string().min(1).max(200),
  weekNumber: z.number().int().min(1).max(104),
  overview: z.string().max(2000).optional(),
  objectives: z.string().max(2000).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  releaseAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export const lessonSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(50000).optional(),
  youtubeVideoId: z
    .string()
    .max(20)
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid YouTube video ID")
    .nullable()
    .optional(),
  durationMin: z.number().int().min(0).max(600).nullable().optional(),
});

export const assignmentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  instructions: z.string().max(5000).optional(),
  requirements: z.string().max(5000).optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  maxScore: z.number().int().min(1).max(1000).default(100),
  allowedTypes: z.array(z.string()).min(1),
  maxFileSizeMb: z.number().int().min(1).max(100).default(10),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  latePolicy: z.enum(["ALLOW", "PENALTY", "BLOCK"]).default("ALLOW"),
});
