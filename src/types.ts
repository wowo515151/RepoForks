export interface ForkDataPoint {
  date: string; // YYYY-MM-DD
  forks: number; // Total forks count
  velocity: number; // Forks per day (forks[t] - forks[t-1])
  acceleration: number; // Change in forks per day (velocity[t] - velocity[t-1])
}

export interface GitHubRepository {
  id: string; // "owner/name"
  name: string;
  owner: string;
  description: string;
  stars: number;
  forksCount: number;
  url: string;
  category: "AI models" | "AI tools" | "Web frameworks" | "Developer tools";
  dataPoints: ForkDataPoint[];
}

export interface ApiUsage {
  requestsMade: number;
  dailyRateLimit: number; // e.g. 1440 for unauthenticated, higher for auth
  safeRateLimit: number; // 10% of daily limit
  remainingRequests: number;
  resetTime: string;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  status: "success" | "warning" | "error";
  message: string;
  reposUpdated: string[];
  callsIncremented: number;
}

export interface RepoForksDatabase {
  repositories: GitHubRepository[];
  apiUsage: ApiUsage;
  syncHistory: SyncLog[];
}
