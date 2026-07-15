export type SupportedFileType = 'md' | 'pdf';

export type RepositoryProfile = {
  id: string;
  displayName: string;
  name: string;
  repo: string;
  rootPath: string;
  token: string;
  cachePdfBlobs: boolean;
  updatedAt: number;
};

export type RepositoryProfileInput = {
  displayName?: string;
  repo: string;
  rootPath?: string;
  token: string;
  cachePdfBlobs?: boolean;
};

export type ViewerFile = {
  name: string;
  path: string;
  sha: string;
  type: SupportedFileType;
};

export type RepositoryIndex = {
  files: ViewerFile[];
  truncated: boolean;
  fromCache: boolean;
  stale: boolean;
};

export type LastOpenedFile = {
  profileId: string;
  file: ViewerFile;
};

export type GitHubTreeItem = {
  path: string;
  sha: string;
  type: 'blob' | 'tree';
};

export type GitHubContentItem = {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir';
};

export type GitHubSearchItem = {
  name: string;
  path: string;
  sha: string;
  text_matches?: Array<{ fragment: string }>;
};
