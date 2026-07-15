/**
 * @typedef {Object} AppSettings
 * @property {string} repo GitHub repository in "owner/repo" form.
 * @property {string} path Root path inside the repository.
 * @property {string} token GitHub personal access token.
 * @property {string} [displayName] User-facing repository profile name.
 * @property {boolean} cachePdfBlobs Whether PDF binary files are cached in IndexedDB.
 */

/**
 * @typedef {'md' | 'pdf'} SupportedFileType
 */

/**
 * @typedef {Object} ViewerFile
 * @property {string} name Display file name.
 * @property {string} path Repository-relative file path.
 * @property {string} sha Git blob SHA.
 * @property {SupportedFileType} type Viewer file type.
 */

/**
 * @typedef {Object} GitHubTreeItem
 * @property {string} path Repository-relative path.
 * @property {string} sha Git object SHA.
 * @property {'blob' | 'tree'} type Git object type.
 */

/**
 * This module only hosts shared JSDoc typedefs.
 */
export {};
