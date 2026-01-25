// Types for game management dashboard

export type GameStatus = 'setup' | 'in_progress' | 'completed';
export type SortField = 'created_at' | 'bank_title' | 'status';
export type SortOrder = 'asc' | 'desc';

export interface GameListItem {
  id: string;
  bank_id: string;
  bank_title: string;
  bank_subject: string;
  status: string | null;
  num_teams: number;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  timer_enabled: boolean | null;
  timer_seconds: number | null;
  team_names: string[] | null;
}

export interface GameListQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: GameStatus | 'all';
  sort?: SortField;
  order?: SortOrder;
}

export interface PaginationData {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface GameListResponse {
  data: GameListItem[];
  pagination: PaginationData;
}

export interface GameFilters {
  search: string;
  status: GameStatus | 'all';
  sort: SortField;
  order: SortOrder;
  page: number;
}
