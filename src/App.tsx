import { useState, useEffect, useMemo } from 'react';
import { 
  GitFork, 
  Activity, 
  TrendingUp, 
  Zap, 
  Cpu, 
  FileText, 
  Terminal, 
  ShieldCheck, 
  Layers, 
  RefreshCw, 
  RotateCcw, 
  AlertCircle, 
  ExternalLink,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { RepoForksDatabase, GitHubRepository } from './types';

export default function App() {
  const [dbState, setDbState] = useState<RepoForksDatabase | null>(null);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<'forks' | 'velocity' | 'acceleration'>('velocity');
  const [durationFilter, setDurationFilter] = useState<'7d' | '14d' | '30d' | 'all'>('7d');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStaticFallback, setIsStaticFallback] = useState<boolean>(false);

  // Fetch the centralized repository telemetry from Express database on mount
  useEffect(() => {
    fetchDatabase();
  }, []);

  const fetchDatabase = async () => {
    try {
      const response = await fetch('/api/database');
      if (!response.ok) throw new Error('Could not fetch active repository metrics.');
      const data = (await response.json()) as RepoForksDatabase;
      setDbState(data);
      setIsStaticFallback(false);
      
      // Auto-select all repositories on first load if none selected
      if (data.repositories.length > 0) {
        setSelectedRepos(data.repositories.map(r => r.id));
      }
    } catch (err: any) {
      console.warn('API fetch failed, attempting static db.json fallback:', err);
      try {
        const response = await fetch('./db.json');
        if (!response.ok) throw new Error('Could not load static file db.json.');
        const data = (await response.json()) as RepoForksDatabase;
        setDbState(data);
        setIsStaticFallback(true);
        
        // Auto-select all repositories on first load if none selected
        if (data.repositories.length > 0) {
          setSelectedRepos(data.repositories.map(r => r.id));
        }
      } catch (fallbackErr: any) {
        setErrorMessage(err.message || 'Server did not respond with compiled database records.');
      }
    }
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      if (!response.ok) throw new Error('Centralized sync cycle failed.');
      const data = await response.json();
      if (data.success && data.data) {
        setDbState(data.data);
      } else {
        throw new Error(data.message || 'Centralized synchronization failed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Fail-safe warning: GitHub server query faulted.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReset = async () => {
    if (isResetting || !window.confirm('Reset local db.json database and query 100% real live GitHub telemetry?')) return;
    setIsResetting(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/reset', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to reset repository seeds.');
      const data = await response.json();
      if (data.success && data.data) {
        setDbState(data.data);
        setSelectedRepos(data.data.repositories.map((r: GitHubRepository) => r.id));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Database reset failed.');
    } finally {
      setIsResetting(false);
    }
  };

  // Helper selectors for checklists
  const toggleRepo = (id: string) => {
    setSelectedRepos(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (!dbState) return;
    setSelectedRepos(dbState.repositories.map(r => r.id));
  };

  const deselectAll = () => {
    setSelectedRepos([]);
  };

  const selectAiOnly = () => {
    if (!dbState) return;
    const aiRepoIds = dbState.repositories
      .filter(r => r.category.startsWith('AI'))
      .map(r => r.id);
    setSelectedRepos(aiRepoIds);
  };

  // Human friendly labels for metrics
  const getMetricTitle = () => {
    if (selectedMetric === 'forks') return 'Total Forks (Cumulative)';
    if (selectedMetric === 'velocity') return 'Fork Velocity (Forks/Day)';
    return 'Fork Acceleration (Change in forks/day)';
  };

  // Color mapping configuration matches the sleeker palette spectrum
  const getRepoColor = (id: string): string => {
    const colors: Record<string, string> = {
      'meta-llama/llama': '#ec4899', // Pink 500
      'huggingface/transformers': '#f59e0b', // Amber 500
      'openai/whisper': '#06b6d4', // Cyan 500
      'google-gemini/gemma-cookbook': '#3b82f6', // Blue 500
      'langchain-ai/langchain': '#10b981', // Emerald 500
      'ollama/ollama': '#8b5cf6', // Violet 500
      'tatsu-lab/stanford_alpaca': '#f97316', // Orange 500
      'facebook/react': '#0ea5e9', // Sky 500
      'tailwindlabs/tailwindcss': '#ef4444', // Red 500
      'denoland/deno': '#64748b', // Slate 500
      'nodejs/node': '#22c55e', // Green 500
    };
    return colors[id] || '#6366f1';
  };

  const formatDateLabel = (dateStr: string): string => {
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Aligns data in chronological charts
  const chartData = useMemo(() => {
    if (!dbState || dbState.repositories.length === 0) return [];

    const datesSet = new Set<string>();
    dbState.repositories.forEach(repo => {
      repo.dataPoints.forEach(dp => {
        datesSet.add(dp.date);
      });
    });

    const sortedDates = Array.from(datesSet).sort();

    let filteredDates = sortedDates;
    if (durationFilter === '7d') {
      filteredDates = sortedDates.slice(-7);
    } else if (durationFilter === '14d') {
      filteredDates = sortedDates.slice(-14);
    } else if (durationFilter === '30d') {
      filteredDates = sortedDates.slice(-30);
    }

    return filteredDates.map(dateStr => {
      const row: any = { 
        rawDate: dateStr,
        date: formatDateLabel(dateStr) 
      };
      
      dbState.repositories.forEach(repo => {
        if (selectedRepos.includes(repo.id)) {
          const point = repo.dataPoints.find(dp => dp.date === dateStr);
          if (point) {
            row[repo.id] = point[selectedMetric];
          } else {
            row[repo.id] = null;
          }
        }
      });
      return row;
    });
  }, [dbState, selectedRepos, selectedMetric, durationFilter]);

  // Derived high performing metrics
  const telemetrySummary = useMemo(() => {
    if (!dbState || dbState.repositories.length === 0) return null;

    let highestVelocityRepo = dbState.repositories[0];
    let maxVelocity = -Infinity;
    let sumVelocity = 0;
    let countDataPoints = 0;
    
    let highestAccelerationRepo = dbState.repositories[0];
    let maxAcceleration = -Infinity;
    
    let hasData = false;

    dbState.repositories.forEach(repo => {
      if (repo.dataPoints && repo.dataPoints.length > 0) {
        hasData = true;
        const latestPoint = repo.dataPoints[repo.dataPoints.length - 1];
        if (latestPoint.velocity > maxVelocity) {
          maxVelocity = latestPoint.velocity;
          highestVelocityRepo = repo;
        }
        if (latestPoint.acceleration > maxAcceleration) {
          maxAcceleration = latestPoint.acceleration;
          highestAccelerationRepo = repo;
        }
        repo.dataPoints.forEach(dp => {
          sumVelocity += dp.velocity;
          countDataPoints++;
        });
      }
    });

    if (!hasData) {
      return {
        highestVelocityRepo: dbState.repositories[0],
        maxVelocity: 0,
        highestAccelerationRepo: dbState.repositories[0],
        maxAcceleration: 0,
        avgVelocity: 0,
        hasData: false
      };
    }

    const avgVelocity = countDataPoints > 0 ? Math.round(sumVelocity / countDataPoints) : 0;

    return {
      highestVelocityRepo,
      maxVelocity,
      highestAccelerationRepo,
      maxAcceleration,
      avgVelocity,
      hasData: true
    };
  }, [dbState]);

  const hasExtendedHistory = useMemo(() => {
    if (!dbState || dbState.repositories.length === 0) return false;
    return dbState.repositories.some(r => r.dataPoints.length > 10);
  }, [dbState]);

  if (!dbState) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-6">
          <div className="relative inline-block">
            <div className="h-16 w-16 rounded-full border-4 border-slate-850 border-t-indigo-500 animate-spin"></div>
            <GitFork className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500 h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">Bootstrapping RepoForks</h2>
            <p className="text-sm text-slate-400 mt-2">Connecting to local database and loading fork acceleration charts...</p>
          </div>
          {errorMessage && (
            <div className="p-3 bg-red-950/50 text-red-400 text-xs rounded-lg border border-red-900 flex items-start gap-2 text-left">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const { repositories, apiUsage, syncHistory } = dbState;
  const lastSyncTimeStr = syncHistory.length > 0 
    ? new Date(syncHistory[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    : 'Recently';

  // Compute percentage representing safe limits
  const apiPercentage = Math.min(100, Math.round((apiUsage.requestsMade / apiUsage.safeRateLimit) * 100));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-x-hidden selection:bg-indigo-500/30 selection:text-white">
      
      {/* --- HEADER (Sleek Interface Specification) --- */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/50 shrink-0 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-500/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 16L12 20L16 16M12 20V12M12 4V8M4 8L8 4L12 8" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              RepoForks <span className="text-slate-500 font-mono text-xs font-semibold">v1.2.0</span>
            </h1>
            <p className="text-[10px] text-slate-400 leading-none">Github.com/Wowo515151/RepoForks</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* API Quota Meter */}
          <div className="hidden sm:flex flex-col items-end">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-mono">
              API Quota Safety ({apiPercentage}%)
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${apiPercentage > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${apiPercentage}%` }}
                ></div>
              </div>
              <span className="text-xs font-mono text-slate-300 font-bold">
                {apiUsage.requestsMade} / {apiUsage.safeRateLimit} safe
              </span>
            </div>
          </div>

          <div className="hidden sm:block h-8 w-[1px] bg-slate-800"></div>

          {/* Sync Time Status Indicator */}
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            Synced: {lastSyncTimeStr}
          </div>
        </div>
      </header>

      {isStaticFallback && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 py-1.5 px-4 text-center text-xs text-amber-300 flex items-center justify-center gap-2">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
          <span><strong>GitHub Pages Mode</strong>: Displaying a pre-assembled static database snapshot. Real-time background sync requires a Node.js Express server backend.</span>
        </div>
      )}

      {/* --- MAIN STRUCTURE (Sidebar + Content Workspace Panel) --- */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        
        {/* --- LEFT SIDEBAR (Controls & Selection Criteria) --- */}
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/30 p-5 flex flex-col gap-6 shrink-0 overflow-y-auto">
          
          {/* Telemetry Control & Agent Status */}
          <section className="space-y-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-850">
            <h3 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-mono flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              Telemetry Protection
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Sync Controls:</span>
                <span className={`font-semibold px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                  isStaticFallback
                    ? 'text-amber-400 bg-amber-950/40 border-amber-900/20'
                    : 'text-emerald-400 bg-emerald-950/40 border-emerald-900/20'
                }`}>
                  {isStaticFallback ? 'STATIC SNAPSHOT' : 'AUTOMATED'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Rate Guard:</span>
                <span className="font-semibold text-slate-300 font-mono text-[10px]">
                  {isStaticFallback ? 'N/A (STATIC MODE)' : 'MAX 10% DAILY CAP'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Status:</span>
                <span className={`font-semibold text-xs ${isStaticFallback ? 'text-amber-400 font-mono text-[11px]' : 'text-slate-200'}`}>
                  {isStaticFallback ? 'GitHub Pages Base' : 'Protected Cache'}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 leading-relaxed pt-1.5 border-t border-slate-800">
              {isStaticFallback 
                ? 'Displaying offline-first JSON dataset. Run locally or stage on a backend cloud container to activate full live synchronization cycles.'
                : 'Manual triggers are locked for standard web users to safeguard GitHub rate limits and ensure maximum cache integrity.'}
            </div>
          </section>

          {/* Metric Selection Stack */}
          <section>
            <h3 className="text-[11px] uppercase tracking-widest text-slate-500 mb-3 font-bold font-mono">Metric Selection</h3>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setSelectedMetric('forks')}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition-all duration-150 cursor-pointer ${
                  selectedMetric === 'forks'
                    ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20 border-transparent'
                    : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>Cumulative Forks</span>
                <span className={selectedMetric === 'forks' ? 'text-indigo-200 font-mono text-[10px]' : 'text-slate-500 font-mono text-[10px]'}>Total</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMetric('velocity')}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition-all duration-150 cursor-pointer ${
                  selectedMetric === 'velocity'
                    ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20 border-transparent'
                    : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>Fork Velocity</span>
                <span className={selectedMetric === 'velocity' ? 'text-indigo-200 font-mono text-[10px]' : 'text-slate-500 font-mono text-[10px]'}>Δf / dt</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMetric('acceleration')}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition-all duration-150 cursor-pointer ${
                  selectedMetric === 'acceleration'
                    ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20 border-transparent'
                    : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>Acceleration</span>
                <span className={selectedMetric === 'acceleration' ? 'text-indigo-200 font-mono text-[10px]' : 'text-slate-500 font-mono text-[10px]'}>Δv / dt</span>
              </button>
            </div>
          </section>

          {/* Repository Filters & Checkboxes */}
          <section className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold font-mono">Repository Filters</h3>
              <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-1.5 py-0.5 rounded font-black leading-none">
                {selectedRepos.length} Sel
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar select-none">
              {repositories.map(repo => {
                const isChecked = selectedRepos.includes(repo.id);
                const color = getRepoColor(repo.id);

                return (
                  <div
                    key={repo.id}
                    onClick={() => toggleRepo(repo.id)}
                    className={`flex items-center justify-between p-2 rounded-lg border transition-all duration-150 cursor-pointer ${
                      isChecked
                        ? 'border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/15'
                        : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 max-w-[80%]">
                      <span 
                        className="w-2 h-2 rounded-full shrink-0" 
                        style={{ backgroundColor: color }}
                      ></span>
                      <span className="text-xs font-semibold text-slate-200 truncate" title={repo.id}>
                        {repo.name}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleRepo(repo.id);
                      }}
                      className="rounded accent-indigo-500 h-3.5 w-3.5 text-indigo-600 border-slate-700 focus:ring-0 bg-slate-800 shrink-0 cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>

            {/* Quick action buttons for checklist selections */}
            <div className="pt-4 grid grid-cols-3 gap-1.5 shrink-0">
              <button
                type="button"
                onClick={selectAll}
                className="py-2 px-1 border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-[10px] text-slate-300 rounded font-semibold transition hover:bg-slate-800 cursor-pointer"
              >
                All
              </button>
              <button
                type="button"
                onClick={selectAiOnly}
                className="py-2 px-1 border border-indigo-500/20 hover:border-indigo-500/40 bg-indigo-950/20 text-[10px] text-indigo-300 rounded font-bold transition hover:bg-indigo-950/40 cursor-pointer"
              >
                AI Only
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="py-2 px-1 border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-[10px] text-slate-400 rounded font-semibold transition hover:bg-slate-800 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </section>

        </aside>

        {/* --- MAIN TELEMETRY WORKSPACE (Sleek Graph Cards & Listings) --- */}
        <main className="flex-1 p-6 flex flex-col gap-6 bg-slate-950 overflow-y-auto">

          {/* Error Message if Present */}
          {errorMessage && (
            <div className="p-4 bg-red-950/40 text-red-300 text-xs rounded-xl border border-red-900/50 flex items-start gap-3 shadow-md">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Execution Warning Note</p>
                <p className="opacity-90">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* HEADER SUMMARY METRIC WIDGET (Sleek Interface Style) */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-slate-800/50 gap-4">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-mono">Focus Range</span>
                <span className="text-sm font-semibold text-slate-200 mt-0.5">
                  {durationFilter === '7d' ? 'Past 7 Days' : durationFilter === '14d' ? 'Past 14 Days' : durationFilter === '30d' ? 'Past 30 Days' : 'Entire Real History'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-mono">Avg. Velocity</span>
                <span className="text-sm font-semibold text-slate-200 mt-0.5">
                  {telemetrySummary && telemetrySummary.hasData ? `${telemetrySummary.avgVelocity} forks/day` : 'Pending Sync'}
                </span>
              </div>
              
              {telemetrySummary && (
                <>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-mono">Top Velocity</span>
                    <span className="text-sm font-semibold text-pink-400 mt-0.5 flex items-center gap-1">
                      <Zap className="h-3.5 w-3.5 fill-pink-500/20" />
                      {telemetrySummary.hasData ? `${telemetrySummary.highestVelocityRepo.name} (+${telemetrySummary.maxVelocity})` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold font-mono">Top Accelerator</span>
                    <span className="text-sm font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {telemetrySummary.hasData ? telemetrySummary.highestAccelerationRepo.name : 'N/A'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Duration Filters Button Array */}
            <div className="flex gap-1.5 shrink-0 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setDurationFilter('7d')}
                className={`px-3 py-1 rounded text-xs transition duration-150 cursor-pointer ${
                  durationFilter === '7d' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                1W
              </button>
              <button
                type="button"
                disabled={!hasExtendedHistory}
                onClick={() => setDurationFilter('14d')}
                className={`px-3 py-1 rounded text-xs transition duration-150 flex items-center gap-1 ${
                  !hasExtendedHistory
                    ? 'text-slate-600 opacity-50 cursor-not-allowed'
                    : durationFilter === '14d'
                      ? 'bg-indigo-600 text-white font-bold cursor-pointer'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900 cursor-pointer'
                }`}
                title={!hasExtendedHistory ? 'Locked while daily records accumulate' : '2 Weeks Range'}
              >
                {!hasExtendedHistory && <span className="text-[10px]">🔒</span>}
                2W
              </button>
              <button
                type="button"
                disabled={!hasExtendedHistory}
                onClick={() => setDurationFilter('30d')}
                className={`px-3 py-1 rounded text-xs transition duration-150 flex items-center gap-1 ${
                  !hasExtendedHistory
                    ? 'text-slate-600 opacity-50 cursor-not-allowed'
                    : durationFilter === '30d'
                      ? 'bg-indigo-600 text-white font-bold cursor-pointer'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900 cursor-pointer'
                }`}
                title={!hasExtendedHistory ? 'Locked while daily records accumulate' : '1 Month Range'}
              >
                {!hasExtendedHistory && <span className="text-[10px]">🔒</span>}
                1M
              </button>
              <button
                type="button"
                disabled={!hasExtendedHistory}
                onClick={() => setDurationFilter('all')}
                className={`px-3 py-1 rounded text-xs transition duration-150 flex items-center gap-1 ${
                  !hasExtendedHistory
                    ? 'text-slate-600 opacity-50 cursor-not-allowed'
                    : durationFilter === 'all'
                      ? 'bg-indigo-600 text-white font-bold cursor-pointer'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900 cursor-pointer'
                }`}
                title={!hasExtendedHistory ? 'Locked while daily records accumulate' : 'Entire Range'}
              >
                {!hasExtendedHistory && <span className="text-[10px]">🔒</span>}
                ALL
              </button>
            </div>
          </div>

          {/* Real Data Mode - Accumulation Notice */}
          {!hasExtendedHistory && (
            <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-xl p-4 flex gap-3 text-xs text-indigo-300 shadow-md">
              <Info className="h-4.5 w-4.5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">100% Real Live GitHub Data Enabled</p>
                <p className="opacity-95 leading-relaxed">
                  RepoForks operates with zero fictitious, simulated, or calculated filler. The dataset is populated with 1 week of initial authentic history queried from the live GitHub REST API. As automated daily runs continue, your local database will safely accumulate longer chronological data. Options for 2W, 1M, and ALL filters are locked and will dynamically unlock as database records establish.
                </p>
              </div>
            </div>
          )}

          {/* MAIN GRAPH CARD */}
          <div className="bg-slate-900/30 p-5 sm:p-6 rounded-2xl border border-slate-800/80 shadow-lg flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <Activity className="h-4.5 w-4.5 text-indigo-400" />
                  Comparative Analytics Curve
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Plotting {getMetricTitle().toLowerCase()} of popular tracked repositories.</p>
              </div>
              <span className="text-[10px] font-bold font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                binned daily
              </span>
            </div>

            <div className="relative">
              {selectedRepos.length === 0 ? (
                <div className="h-[360px] rounded-xl bg-slate-950 border border-dashed border-slate-850 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <Layers className="h-10 w-10 text-slate-700 animate-pulse" />
                  <p className="text-sm font-bold text-slate-300">No Repositories Hooked To Chart</p>
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed">Toggle the checkboxes of tracked repositories in the side layout panel to map historical profiles.</p>
                  <button 
                    onClick={selectAll} 
                    className="px-4 py-1.5 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-500 transition cursor-pointer"
                  >
                    Select All Repositories
                  </button>
                </div>
              ) : (
                <div className="h-[365px] w-full" id="repository-charts-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 12, right: 10, left: -5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10, fill: '#64748b', fontWeight: 500 }}
                        tickLine={false}
                        axisLine={{ stroke: '#334155' }}
                        dy={10}
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }}
                        tickLine={false}
                        axisLine={false}
                        dx={-5}
                        label={{ 
                          value: getMetricTitle(), 
                          angle: -90, 
                          position: 'insideLeft', 
                          style: { fontSize: 10, fontWeight: 'bold', fill: '#94a3b8', fontFamily: 'sans-serif' },
                          offset: 10
                        }}
                      />
                      <Tooltip 
                        content={<CustomTooltip activeMetric={selectedMetric} />}
                      />
                      <Legend 
                        verticalAlign="top" 
                        height={35} 
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, fontWeight: 500, color: '#94a3b8' }}
                      />
                      {repositories
                        .filter(r => selectedRepos.includes(r.id))
                        .map(repo => (
                          <Line
                            key={repo.id}
                            type="monotone"
                            dataKey={repo.id}
                            name={repo.name}
                            stroke={getRepoColor(repo.id)}
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 1.5 }}
                            connectNulls
                          />
                        ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* DETAILED CHECKLIST TABLE */}
          <div className="bg-slate-900/30 rounded-xl border border-slate-800/80 overflow-hidden shadow-lg">
            <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Tracked Repository Indexes & Telemetry</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Toggle checkpoints to configure lines. Direct GitHub integrations loaded.</p>
              </div>
              <span className="text-[10px] font-bold font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                Total Loaded: {repositories.length} Repositories
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/75 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider font-mono text-[9px]">
                    <th className="py-3 px-4 w-12 text-center">Chart</th>
                    <th className="py-3 px-4">Repository</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Stars</th>
                    <th className="py-3 px-4 text-right">Forks (Total)</th>
                    <th className="py-3 px-4 text-right">Velocity</th>
                    <th className="py-3 px-4 text-right">Acceleration</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/55">
                  {repositories.map(repo => {
                    const isChecked = selectedRepos.includes(repo.id);
                    const latestPoint = repo.dataPoints[repo.dataPoints.length - 1] || { forks: repo.forksCount, velocity: 0, acceleration: 0 };
                    const color = getRepoColor(repo.id);
                    
                    return (
                      <tr 
                        key={repo.id} 
                        onClick={() => toggleRepo(repo.id)}
                        className={`hover:bg-slate-800/30 transition duration-100 cursor-pointer ${isChecked ? 'bg-transparent' : 'bg-slate-900/10'}`}
                      >
                        {/* Checkbox selector */}
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRepo(repo.id)}
                            className="h-4 w-4 rounded accent-indigo-600 text-indigo-600 border-slate-700 bg-slate-800 focus:ring-0 shrink-0 cursor-pointer"
                          />
                        </td>

                        {/* Name / Description */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="flex items-center gap-2">
                            <span 
                              className="h-2.5 w-2.5 rounded-full shrink-0" 
                              style={{ backgroundColor: color }}
                            ></span>
                            <span className="font-bold text-slate-100 text-sm truncate">{repo.name}</span>
                            <span className="text-slate-500 font-mono text-[10px]">({repo.owner})</span>
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5 leading-tight line-clamp-1">{repo.description}</p>
                        </td>

                        {/* Category Badge */}
                        <td className="py-3 px-4">
                          <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded ${
                            repo.category === 'AI models' ? 'bg-pink-950/40 text-pink-400 border border-pink-900/30' :
                            repo.category === 'AI tools' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30' :
                            repo.category === 'Web frameworks' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/30' :
                            'bg-slate-850 text-slate-350 border border-slate-750'
                          }`}>
                            {repo.category}
                          </span>
                        </td>

                        {/* Star figures */}
                        <td className="py-3 px-4 text-right font-mono text-slate-300 font-medium">
                          {repo.stars.toLocaleString()}
                        </td>

                        {/* Forks figures */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {repo.forksCount.toLocaleString()}
                        </td>

                        {/* Velocity forks/day */}
                        <td className="py-3 px-4 text-right font-mono">
                          <span className="text-pink-400 font-bold">+{latestPoint.velocity}</span>
                          <span className="text-[10px] text-slate-500 font-sans ml-0.5">/d</span>
                        </td>

                        {/* Acceleration */}
                        <td className="py-3 px-4 text-right font-mono">
                          <span className={latestPoint.acceleration > 0 ? 'text-emerald-400 font-bold' : latestPoint.acceleration < 0 ? 'text-slate-500' : 'text-slate-400'}>
                            {latestPoint.acceleration > 0 ? '+' : ''}{latestPoint.acceleration}
                          </span>
                        </td>

                        {/* Outward Link */}
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <a 
                            href={repo.url} 
                            target="_blank" 
                            referrerPolicy="no-referrer"
                            rel="noopener noreferrer"
                            className="p-1 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded inline-flex items-center gap-1 text-[10px] text-slate-300 font-semibold transition"
                          >
                            Repo <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* LOGS TERMINAL (Sleek Interface Console style) */}
          <div className="bg-slate-900/40 text-slate-300 rounded-xl p-5 border border-slate-800/80 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Terminal className="h-4 w-4 text-indigo-400" />
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">GitHub Actions forksrefresh Simulator Terminal</h4>
                  <p className="text-[10px] text-slate-400 leading-none mt-1">Automated background sequence event history logs.</p>
                </div>
              </div>
              <div className="text-[10px] font-mono text-indigo-400 bg-indigo-950/40 border border-indigo-900/30 px-2 py-0.5 rounded">
                Telemetry Sync Active
              </div>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1 font-mono text-[11px] scrollbar">
              {syncHistory.map((log) => (
                <div key={log.id} className="p-2 rounded bg-slate-950/80 border border-slate-850 space-y-1">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[9.5px]">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        log.status === 'success' ? 'bg-emerald-400' : log.status === 'warning' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
                      }`}></span>
                      <span className="font-bold text-slate-300">
                        Task ID: {log.id}
                      </span>
                      <span className="text-slate-500">
                        | {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <span className={`font-bold px-1.5 rounded text-[8.5px] ${
                      log.status === 'success' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed pl-3.5 border-l border-slate-800 mt-1">
                    {log.message}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </main>
      </div>

      {/* --- MIT LICENSE & FOOTER (Sleek Interface Specification) --- */}
      <footer className="h-10 border-t border-slate-800 bg-slate-900 flex items-center justify-between px-6 text-[11px] text-slate-500 italic shrink-0 gap-4">
        <div>
          &copy; 2026 RepoForks Project • MIT License • Von/VonProjects/RepoForks
        </div>
        <div>
          Data sourced via GitHub API • Refreshed Daily via GitHub Actions Sim
        </div>
      </footer>

    </div>
  );
}

// Custom Tooltip Component for Multi-line charts to provide high-quality list mapping
interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  activeMetric: 'forks' | 'velocity' | 'acceleration';
}

function CustomTooltip({ active, payload, label, activeMetric }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const sortedPayload = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0));

  return (
    <div className="bg-slate-900 text-white rounded-lg p-3 shadow-2xl border border-slate-800 text-xs min-w-[220px] space-y-2">
      <div className="border-b border-slate-800 pb-1 flex items-center justify-between gap-2.5 font-mono">
        <span className="font-bold text-indigo-400">{label}</span>
        <span className="text-[9px] text-slate-500 uppercase">Daily Bin</span>
      </div>
      <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
        {sortedPayload.map((item, index) => {
          return (
            <div key={item.dataKey || index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                <span 
                  className="h-2 w-2 rounded-full shrink-0" 
                  style={{ backgroundColor: item.stroke }}
                ></span>
                <span className="font-medium text-slate-300 truncate">{item.name}</span>
              </div>
              <span className="font-mono text-white font-bold">
                {typeof item.value === 'number' ? item.value.toLocaleString() : 'N/A'}
                <span className="text-[9px] text-slate-500 font-normal ml-0.5">
                  {activeMetric === 'forks' ? '' : activeMetric === 'velocity' ? ' v' : ' a'}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
