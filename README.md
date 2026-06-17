# GitHub Fork Momentum Dashboard

A high-fidelity developer analytics dashboard tracking the growth trajectory, velocity, and acceleration of influential open-source software repositories. 

👉 **Live Demo (GitHub Pages)**: [https://wowo515151.github.io/RepoForks/](https://wowo515151.github.io/RepoForks/)

This platform allows developers, researchers, and project maintainers to view more than just cumulative stars—it calculates the true momentum (**Fork Velocity** and **Fork Acceleration**) of major AI models, web frameworks, and developer tools using active, real-time GitHub telemetry.

---

## 🚀 Key Features

* **Advanced Momentum Metrics**:
  * **Cumulative Forks**: Traditional absolute interest over time.
  * **Fork Velocity ($\Delta f / \Delta t$)**: Daily rate of fork creation (forks per day).
  * **Fork Acceleration ($\Delta v / \Delta t$)**: Rate of change of fork velocity, indicating rapid community growth or cooling off.
* **Curated Repository Categories**:
  * **AI Models**: Llama, Transformers, Whisper, ALPACA.
  * **AI Tools**: Gemma Cookbook, LangChain, Ollama.
  * **Web Frameworks**: React, Tailwind CSS.
  * **Developer Tools**: Deno, Node.js.
* **Interactive Visualization Engine**: Built with Recharts and customized color profiles for each repository. Supports flexible time filtration (7 Days, 30 Days, 3 Months, All Time).
* **Live Telemetry & Rate-Limit Safeguards**: An intelligent background sync worker with Express-based proxy routes requesting real-time GitHub repository statistics and updating history without hitting rate limits.

---

## 🛠️ Technology Stack

* **Frontend**: React 18+, Vite, Tailwind CSS, Recharts for advanced chart components, and Lucide React.
* **Backend**: Express server running on Node.js using `tsx`, proxying telemetry updates and managing disk-persisted data dynamically in `db.json`.
* **Licensing**: Fully open-source and permissible.

---

## 💻 Getting Started

### Prerequisites

* Node.js (v18+)
* npm (v9+)

### Installation

1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   cd YOUR_REPO_NAME
   ```

2. Install the program dependencies:
   ```bash
   npm install
   ```

### Running the Application

* **Development Mode** (Vite + Express backend in hot-reload mode):
  ```bash
  npm run dev
  ```
  The app will bind and be accessible at `http://localhost:3000`.

* **Production Build & Execution**:
  ```bash
  # Compile assets & bundle the server
  npm run build
  
  # Boot up production server
  npm start
  ```

### 🌐 Deploying to GitHub Pages (Static Snapshot Mode)

To host a static version of this dashboard directly on **GitHub Pages**, follow these simple steps:

1. **Install the `gh-pages` helper package**:
   ```bash
   npm install gh-pages --save-dev
   ```

2. **Add deployment scripts** to your `package.json` under `"scripts"`:
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```

3. **Deploy the application**:
   ```bash
   npm run deploy
   ```

This compiles your assets and Bundles the database (`db.json`) directly into the production `dist/` directory via our custom Vite build plugins. It then automatically creates/updates a `gh-pages` branch on your GitHub repository and deploys the assets.

*Note: Because GitHub Pages serves static files only, server-side cron sync and write routines are inactive. The application gracefully identifies this environment and triggers **GitHub Pages Mode**, which visualizes the stable pre-compiled database snapshot with custom notices.*

---

## 📄 License & Ownership

This project is open-source software licensed under the **MIT License**.

Copyright © 2026 **Warren Harding**.
