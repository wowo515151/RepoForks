var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_vite = require("vite");

// src/dataManager.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var DB_PATH = import_path.default.join(process.cwd(), "db.json");
var TARGET_REPOS = [
  { owner: "meta-llama", name: "llama", category: "AI models" },
  { owner: "huggingface", name: "transformers", category: "AI models" },
  { owner: "openai", name: "whisper", category: "AI models" },
  { owner: "google-gemini", name: "gemma-cookbook", category: "AI tools" },
  { owner: "langchain-ai", name: "langchain", category: "AI tools" },
  { owner: "ollama", name: "ollama", category: "AI tools" },
  { owner: "tatsu-lab", name: "stanford_alpaca", category: "AI models" },
  { owner: "facebook", name: "react", category: "Web frameworks" },
  { owner: "tailwindlabs", name: "tailwindcss", category: "Web frameworks" },
  { owner: "denoland", name: "deno", category: "Developer tools" },
  { owner: "nodejs", name: "node", category: "Developer tools" }
];
function generateSeedDatabase() {
  const repositories = TARGET_REPOS.map((target) => {
    return {
      id: `${target.owner}/${target.name}`,
      name: target.name,
      owner: target.owner,
      description: `Official repository for ${target.name}. Loading real GitHub info...`,
      stars: 0,
      forksCount: 0,
      url: `https://github.com/${target.owner}/${target.name}`,
      category: target.category,
      dataPoints: []
      // Starts empty - populated purely via live API query
    };
  });
  return {
    repositories,
    apiUsage: {
      requestsMade: 0,
      dailyRateLimit: 1440,
      // 60 requests per hour * 24
      safeRateLimit: 144,
      // 10% safety daily limit
      remainingRequests: 144,
      resetTime: new Date(Date.now() + 60 * 60 * 1e3).toISOString()
    },
    syncHistory: [
      {
        id: "initial-seed",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: "success",
        message: "Database initialized. Sync pending for 100% real GitHub data.",
        reposUpdated: [],
        callsIncremented: 0
      }
    ]
  };
}
function getDatabase() {
  try {
    if (import_fs.default.existsSync(DB_PATH)) {
      const dataStr = import_fs.default.readFileSync(DB_PATH, "utf8");
      const db = JSON.parse(dataStr);
      if (db && Array.isArray(db.repositories) && db.apiUsage) {
        return db;
      }
    }
  } catch (error) {
    console.error("Failed to read db.json, generating a new one...", error);
  }
  const seeded = generateSeedDatabase();
  saveDatabase(seeded);
  return seeded;
}
function saveDatabase(db) {
  try {
    import_fs.default.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write db.json", e);
  }
}
async function runForksRefresh(optionalGithubToken) {
  const db = getDatabase();
  const updatedRepos = [];
  let apiCallsCount = 0;
  const apiLimitExceeded = db.apiUsage.requestsMade >= db.apiUsage.safeRateLimit;
  const dates = [];
  const now = /* @__PURE__ */ new Date();
  for (let i = 7; i >= 0; i--) {
    const d = /* @__PURE__ */ new Date();
    d.setDate(now.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  const headers = {
    "User-Agent": "RepoForks-App-Wowo515151"
  };
  if (optionalGithubToken) {
    headers["Authorization"] = `token ${optionalGithubToken}`;
  }
  if (apiLimitExceeded) {
    console.warn("API Safe Rate Limit exceeded. Keeping existing real data without adding simulated entries.");
    return db;
  }
  let API_RATE_LIMIT_HIT = false;
  for (const repo of db.repositories) {
    if (API_RATE_LIMIT_HIT) {
      console.warn(`Skipping ${repo.id} due to prior API rate limit or error.`);
      continue;
    }
    try {
      apiCallsCount++;
      const repoRes = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`, { headers });
      const limitHeader = repoRes.headers.get("x-ratelimit-limit");
      const remainingHeader = repoRes.headers.get("x-ratelimit-remaining");
      const resetHeader = repoRes.headers.get("x-ratelimit-reset");
      if (limitHeader) db.apiUsage.dailyRateLimit = parseInt(limitHeader, 10) * 24;
      if (remainingHeader) db.apiUsage.remainingRequests = parseInt(remainingHeader, 10);
      if (resetHeader) {
        const resetEpoch = parseInt(resetHeader, 10);
        db.apiUsage.resetTime = new Date(resetEpoch * 1e3).toISOString();
      }
      if (!repoRes.ok) {
        if (repoRes.status === 403 || repoRes.status === 429) {
          console.error(`GitHub API rate limit hit during metadata query for ${repo.id}: ${repoRes.status}`);
          API_RATE_LIMIT_HIT = true;
          db.apiUsage.remainingRequests = 0;
          continue;
        }
        console.warn(`GitHub API request failed for metadata of ${repo.id}: ${repoRes.status}`);
        continue;
      }
      const repoData = await repoRes.json();
      const liveForksCount = repoData.forks_count;
      repo.stars = repoData.stargazers_count;
      if (repoData.description) {
        repo.description = repoData.description;
      }
      let forksList = [];
      let page = 1;
      while (page <= 1) {
        apiCallsCount++;
        const forksRes = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/forks?per_page=100&page=${page}`, { headers });
        if (!forksRes.ok) {
          if (forksRes.status === 403 || forksRes.status === 429) {
            console.error(`GitHub API rate limit hit during forks fetch for ${repo.id}: ${forksRes.status}`);
            API_RATE_LIMIT_HIT = true;
            db.apiUsage.remainingRequests = 0;
            break;
          }
          console.warn(`GitHub API request failed for forks page ${page}: ${forksRes.status}`);
          break;
        }
        const forksData = await forksRes.json();
        if (!Array.isArray(forksData) || forksData.length === 0) {
          break;
        }
        forksList = forksList.concat(forksData);
        const oldestFork = forksData[forksData.length - 1];
        if (oldestFork && oldestFork.created_at) {
          const oldestDateStr = oldestFork.created_at.split("T")[0];
          if (oldestDateStr < dates[0]) {
            break;
          }
        }
        page++;
      }
      if (API_RATE_LIMIT_HIT) {
        continue;
      }
      const forkCountsByDate = {};
      for (const d of dates) {
        forkCountsByDate[d] = 0;
      }
      for (const f of forksList) {
        if (f && f.created_at) {
          const dateStr = f.created_at.split("T")[0];
          if (forkCountsByDate.hasOwnProperty(dateStr)) {
            forkCountsByDate[dateStr]++;
          }
        }
      }
      const F = {};
      F[dates[7]] = liveForksCount;
      for (let i = 6; i >= 0; i--) {
        const nextDate = dates[i + 1];
        const currentDate = dates[i];
        F[currentDate] = F[nextDate] - forkCountsByDate[nextDate];
      }
      const newDataPoints = [];
      for (let i = 1; i <= 7; i++) {
        const dateStr = dates[i];
        const prevDateStr = dates[i - 1];
        const velocity = forkCountsByDate[dateStr];
        const prevVelocity = forkCountsByDate[prevDateStr];
        const acceleration = velocity - prevVelocity;
        newDataPoints.push({
          date: dateStr,
          forks: F[dateStr],
          velocity,
          acceleration
        });
      }
      const mergedPointsMap = {};
      if (Array.isArray(repo.dataPoints)) {
        for (const dp of repo.dataPoints) {
          if (dp && dp.date) {
            mergedPointsMap[dp.date] = dp;
          }
        }
      }
      for (const dp of newDataPoints) {
        mergedPointsMap[dp.date] = dp;
      }
      const sortedDataPoints = Object.values(mergedPointsMap).sort((a, b) => a.date.localeCompare(b.date));
      repo.forksCount = liveForksCount;
      repo.dataPoints = sortedDataPoints;
      updatedRepos.push(repo.id);
    } catch (err) {
      console.error(`Error fetching real stats for ${repo.id}:`, err);
    }
  }
  db.apiUsage.requestsMade += apiCallsCount;
  db.apiUsage.remainingRequests = Math.max(0, db.apiUsage.safeRateLimit - db.apiUsage.requestsMade);
  const status = API_RATE_LIMIT_HIT ? "warning" : "success";
  const logMessage = API_RATE_LIMIT_HIT ? `Rate limit safeguard triggered: Sync stopped after updating some repositories to protect rate limits limit. Incremented ${apiCallsCount} queries.` : `ForksRefresh executed successfully. Fetched 100% real telemetry with ${apiCallsCount} live queries.`;
  const syncLogEntry = {
    id: `sync-${Date.now()}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    status,
    message: logMessage,
    reposUpdated: updatedRepos,
    callsIncremented: apiCallsCount
  };
  db.syncHistory.unshift(syncLogEntry);
  if (db.syncHistory.length > 50) {
    db.syncHistory.pop();
  }
  saveDatabase(db);
  return db;
}

// server.ts
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      console.log(`[RepoForks API] ${req.method} ${req.path}`);
    }
    next();
  });
  try {
    const db = getDatabase();
    console.log(`[RepoForks DB] Loaded database containing ${db.repositories.length} tracking repositories.`);
  } catch (error) {
    console.error("[RepoForks DB] Initialization failed:", error);
  }
  setTimeout(() => {
    console.log("[RepoForks Routine] Performing startup ForksRefresh sweep...");
    runForksRefresh(process.env.GITHUB_TOKEN).then((updatedDb) => {
      console.log(`[RepoForks Routine] Startup sweep completed. Call usage: ${updatedDb.apiUsage.requestsMade} queries.`);
    }).catch((err) => {
      console.error("[RepoForks Routine] Startup sweep failed:", err);
    });
  }, 3e3);
  const DAY_IN_MS = 24 * 60 * 60 * 1e3;
  setInterval(() => {
    console.log("[RepoForks Routine] Initiating scheduled daily ForksRefresh sweep...");
    try {
      const db = getDatabase();
      db.apiUsage.requestsMade = 0;
      saveDatabase(db);
    } catch (e) {
      console.error("Failed to reset daily API requests made counter", e);
    }
    runForksRefresh(process.env.GITHUB_TOKEN).then(() => {
      console.log("[RepoForks Routine] Daily sync cycle completed successfully.");
    }).catch((err) => {
      console.error("[RepoForks Routine] Daily sync cycle faulted:", err);
    });
  }, DAY_IN_MS);
  app.get("/api/database", (req, res) => {
    try {
      const db = getDatabase();
      res.json(db);
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve repository data." });
    }
  });
  app.post("/api/sync", async (req, res) => {
    try {
      console.log("[RepoForks API] Direct manual sync request received.");
      const updatedDb = await runForksRefresh(process.env.GITHUB_TOKEN);
      res.json({
        success: true,
        message: "Manual ForksRefresh trigger completed successfully.",
        data: updatedDb
      });
    } catch (error) {
      console.error("[RepoForks API] Manual sync exception:", error);
      res.status(500).json({
        success: false,
        error: "Manual ForksRefresh sequence failed.",
        message: error.message || String(error)
      });
    }
  });
  app.post("/api/reset", (req, res) => {
    try {
      console.log("[RepoForks API] database reset requested.");
      const freshSeed = generateSeedDatabase();
      saveDatabase(freshSeed);
      res.json({
        success: true,
        message: "Repository database successfully reset to clean telemetry, ready for 100% real live GitHub updates.",
        data: freshSeed
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset database." });
    }
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", datetime: (/* @__PURE__ */ new Date()).toISOString() });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[RepoForks System] Server running with Node on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
