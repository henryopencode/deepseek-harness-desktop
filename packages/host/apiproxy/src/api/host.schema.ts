/**
 * host domain zod schemas (names derived from map keys).
 */

import { z } from 'zod'
import type { DirectoryEntry, RuntimeUpdatePhase } from './host.ts'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'

/** host.describe request payload (empty object literal). */
export const hostDescribeRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.describe'>>>

/** host.describe response value. */
export const hostDescribeValueSchema = z.object({
  version: z.string(),
  cwd: z.string(),
  provider: z.string().optional(),
  model: z.string().optional(),
  attachedSessions: z.number().int().nonnegative(),
  home: z.string(),
  canOpenPath: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.describe'>>>

/** host.pickDirectory request payload (empty object literal). */
export const hostPickDirectoryRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.pickDirectory'>>>

/** host.pickDirectory response value; null means the user cancelled. */
export const hostPickDirectoryValueSchema = z.object({
  path: z.string().nullable(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.pickDirectory'>>>

/** Directory row shared by listing entries and breadcrumb crumbs. */
export const directoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  hidden: z.boolean(),
}) satisfies z.ZodType<Wire<DirectoryEntry>>

/** host.listDirectory request payload; an absent path lists the home directory. */
export const hostListDirectoryRequestSchema = z.object({
  path: z.string().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'host.listDirectory'>>>

/** host.listDirectory response value. */
export const hostListDirectoryValueSchema = z.object({
  path: z.string(),
  home: z.string(),
  crumbs: z.array(directoryEntrySchema),
  entries: z.array(directoryEntrySchema),
  truncated: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.listDirectory'>>>

/** host.createDirectory request payload: name must be one plain path segment. */
export const hostCreateDirectoryRequestSchema = z.object({
  path: z.string(),
  name: z.string(),
}).refine(
  payload => payload.name.trim() !== '' && payload.name !== '.' && payload.name !== '..'
    && !/[/\\]/.test(payload.name),
  { message: 'host.createDirectory requires a single non-blank path segment name' },
) satisfies z.ZodType<Wire<RequestPayload<'host.createDirectory'>>>

/** host.createDirectory response value: the created directory's absolute path. */
export const hostCreateDirectoryValueSchema = z.object({
  path: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.createDirectory'>>>
/** host.openPath request payload. */
export const hostOpenPathRequestSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.openPath'>>>

/** host.openPath response value. */
export const hostOpenPathValueSchema = z.object({
  opened: z.literal(true),
}) satisfies z.ZodType<Wire<ResponseValue<'host.openPath'>>>

/** host.uploadDroppedFile request payload: base64 bytes, one basename, a project root. */
export const hostUploadDroppedFileRequestSchema = z.object({
  name: z.string().min(1).refine(
    name => name !== '.' && name !== '..' && !/[/\\]/.test(name),
    { message: 'host.uploadDroppedFile requires a single non-blank basename' },
  ),
  content: z.string().min(1),
  cwd: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'host.uploadDroppedFile'>>>

/** host.uploadDroppedFile response value: the written file's absolute path. */
export const hostUploadDroppedFileValueSchema = z.object({
  path: z.string().min(1),
}) satisfies z.ZodType<Wire<ResponseValue<'host.uploadDroppedFile'>>>

/** host.updateCheck request payload (empty object literal). */
export const hostUpdateCheckRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.updateCheck'>>>

/** host.updateCheck response value. */
export const hostUpdateCheckValueSchema = z.object({
  currentVersion: z.string(),
  latestVersion: z.string(),
  updateAvailable: z.boolean(),
  installAvailable: z.boolean().optional(),
  releaseUrl: z.string().optional(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.updateCheck'>>>

/** host.updateStatus request payload (empty object literal). */
export const hostUpdateStatusRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.updateStatus'>>>

/** host.updateStatus response value. */
export const hostUpdateStatusValueSchema = z.object({
  phase: z.enum([
    'idle', 'checking', 'downloading', 'verifying', 'extracting', 'installing',
    'switching', 'restarting', 'completed', 'failed',
  ] satisfies RuntimeUpdatePhase[]),
  progress: z.number().min(0).max(100),
  currentVersion: z.string().optional(),
  targetVersion: z.string().optional(),
  bytesDownloaded: z.number().int().nonnegative().optional(),
  bytesTotal: z.number().int().positive().optional(),
  error: z.string().optional(),
}) satisfies z.ZodType<Wire<ResponseValue<'host.updateStatus'>>>

/** host.updateInstall request payload (empty object literal). */
export const hostUpdateInstallRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'host.updateInstall'>>>

/** host.updateInstall response value. */
export const hostUpdateInstallValueSchema = z.object({
  accepted: z.literal(true),
}) satisfies z.ZodType<Wire<ResponseValue<'host.updateInstall'>>>
