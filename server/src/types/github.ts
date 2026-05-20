export type GitHubContentItem = {
  name: string;
  download_url?: string;
  type: string;
  path: string;
};

export type GitHubTreeEntry = {
  name: string;
  type: string;
  oid: string;
};

export type LanguageEdge = {
  size: number;
  node: {
    name: string;
    color?: string | null;
  };
};

export type GitHubFileNamesResponse = {
  data?: {
    repository?: {
      object?: {
        entries?: GitHubTreeEntry[];
      };
      languages?: {
        edges?: LanguageEdge[];
      };
    };
  };
};

export type GitHubFileContentResponse = {
  data?: {
    repository?: {
      object?: {
        text?: string;
      };
    };
  };
};

export type GitHubDownloadInfoResponse = {
  data?: {
    repository?: {
      object?: {
        downloadUrl?: string;
        byteSize?: number;
        name?: string;
      };
    };
  };
};

export type GitHubCommitHistoryResponse = {
  data?: {
    repository?: {
      defaultBranchRef?: {
        target?: {
          history?: {
            nodes?: unknown[];
          };
        };
      };
    };
  };
};

export type GitHubRepoStatsResponse = {
  data?: {
    repository?: unknown;
  };
};
