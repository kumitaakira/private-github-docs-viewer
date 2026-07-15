import { z } from 'zod';

export const repositoryProfileInputSchema = z.object({
  displayName: z.string().trim().max(80).optional().default(''),
  repo: z
    .string()
    .trim()
    .regex(/^[^/\s]+\/[^/\s]+$/, 'invalidRepo'),
  rootPath: z.string().trim().optional().default(''),
  token: z.string().trim().min(1, 'tokenRequired'),
  cachePdfBlobs: z.boolean().optional().default(false),
});

export const repositoryProfileSchema = repositoryProfileInputSchema.extend({
  id: z.string().min(1),
  name: z.string().min(1),
  updatedAt: z.number(),
});

export const viewerFileSchema = z.object({
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  type: z.enum(['md', 'pdf']),
});

export const lastOpenedFileSchema = z.object({
  profileId: z.string(),
  file: viewerFileSchema,
});

export const legacyLastOpenedFileSchema = z.object({
  repo: z.string(),
  rootPath: z.string(),
  name: z.string(),
  path: z.string(),
  sha: z.string(),
  type: z.enum(['md', 'pdf']),
});

export type RepositoryProfileFormInput = z.input<typeof repositoryProfileInputSchema>;
export type RepositoryProfileFormValues = z.output<typeof repositoryProfileInputSchema>;
