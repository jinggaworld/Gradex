/**
 * Gradex End-to-End Test Scenarios
 *
 * These scenarios cover the complete user journey through the Gradex platform.
 * Run manually or with Playwright for automated testing.
 *
 * Usage (if running with TypeScript):
 *   npx ts-node scripts/e2e-tests.ts
 *
 * Or use with Playwright:
 *   npx playwright test
 */

interface TestScenario {
  name: string;
  steps: string[];
  expectedOutcome: string;
}

const TEST_SCENARIOS: TestScenario[] = [
  {
    name: "Wallet Connection",
    steps: [
      "Open landing page at http://localhost:3000",
      "Verify hero section loads with title and CTA buttons",
      "Click 'Launch App' button",
      "Dashboard shows 'Connect Your Wallet' prompt",
      "Click 'Connect Wallet' button",
      "Verify Casper Wallet extension prompts for connection",
      "Approve connection in wallet extension",
      "Verify dashboard shows connected state with public key and balance",
    ],
    expectedOutcome: "User sees wallet address, CSPR balance, and dashboard UI",
  },
  {
    name: "Trader Discovery",
    steps: [
      "Navigate to /traders",
      "Verify trader cards load from API (or see loading skeleton → empty state)",
      "Type in search box to filter traders",
      "Verify search input is functional (debounced fetch)",
      "Click sort dropdown and change to 'Volume'",
      "Click 'Filters' toggle to show filter panel",
      "Adjust risk level filter pills",
      "Adjust minimum AI Score slider",
      "Click 'Reset All' to clear filters",
      "Click on a trader card to navigate to detail page",
    ],
    expectedOutcome: "User can browse, search, filter, and sort traders; clicking a trader navigates to their detail page",
  },
  {
    name: "Trader Detail & AI Scoring",
    steps: [
      "Navigate to /traders/[address]",
      "Verify trader header loads with avatar, name, bio",
      "Verify back link navigates to /traders",
      "Verify explorer link opens CSPR.live in new tab",
      "Verify 'Subscribe' button is visible (or prompts connect)",
      "Verify 'Run AI Check' button is visible",
      "Click 'Run AI Check'",
      "Wait for scoring to complete",
      "Verify AI Score card displays with: score circle, recommendation badge, reasoning, strengths, red flags, risk level",
      "Click 'Refresh Score' button to re-trigger scoring",
    ],
    expectedOutcome: "AI score card displays with all sections; repeat scoring works",
  },
  {
    name: "Subscription Flow",
    steps: [
      "Navigate to /subscribe?trader=[address]",
      "Verify back link navigates to trader detail page",
      "Verify allocation input is pre-filled with 1000",
      "Verify wallet balance is displayed",
      "Enter an allocation amount exceeding balance",
      "Verify 'Insufficient balance' warning appears",
      "Fix the amount to a valid value",
      "Adjust max drawdown slider from 50% to 30%",
      "Verify drawdown percentage updates",
      "Toggle auto-compound switch off and on",
      "Verify subscription summary shows: trader name, allocation, drawdown, auto-compound",
      "Click 'Confirm Subscription'",
      "Verify 'Confirming' screen with spinner appears",
      "Verify 'Success' screen with transaction link appears",
      "Click 'Go to Dashboard' link",
      "Click 'Browse More Traders' link",
    ],
    expectedOutcome: "Full subscription flow works end-to-end with validation, confirmation, and success states",
  },
  {
    name: "Portfolio Management",
    steps: [
      "Navigate to /dashboard/portfolio",
      "If not connected, verify 'Connect Wallet' prompt",
      "Connect wallet (if not already connected)",
      "If no positions, verify empty state with 'Explore Traders' button",
      "If positions exist: verify portfolio summary cards show total invested, current value, PnL, royalties",
      "Verify PnL colors: green for profit, red for loss",
      "Verify positions table with columns: trader, allocated, current, PnL, auto, actions",
      "Click 'More' action menu on a position",
      "Verify menu shows: Adjust Allocation, View Copy Trades, Unsubscribe",
      "Click 'Adjust Allocation'",
      "Verify modal opens with current allocation pre-filled",
      "Modify amount and click 'Save Changes'",
      "Verify modal closes",
    ],
    expectedOutcome: "Portfolio page displays summary, charts, PnL distribution, and positions table with working action menu",
  },
  {
    name: "Copy Trades History",
    steps: [
      "Navigate to /dashboard/copies",
      "If not connected, verify 'Connect Wallet' prompt",
      "If no trades, verify empty state with appropriate message",
      "If trades exist: verify trade rows show action (buy/sell), token, dex, amounts, PnL, status, explorer link",
      "Click 'buy' filter button",
      "Verify only buy trades are shown (or empty message)",
      "Click 'sell' filter",
      "Click 'profit' filter",
      "Click 'loss' filter",
      "Click 'all' to clear filters",
      "Verify status badges: executed (green), pending (yellow), failed (red)",
      "Click explorer external link icon",
      "Verify opens CSPR.live in new tab",
    ],
    expectedOutcome: "Copy trades page shows filtered trade history with correct action icons and status colors",
  },
  {
    name: "Leaderboard",
    steps: [
      "Navigate to /leaderboard",
      "Verify page title with trophy icon",
      "Verify time filter buttons: All Time, 7 Days, 30 Days",
      "Verify table headers: Rank, Trader, Score, ROI, Win Rate, Followers, Volume",
      "If entries exist: verify top 3 have medal icons (gold, silver, bronze)",
      "Verify score colors: green (≥70), yellow (40-69), red (<40)",
      "Verify ROI colors: green (positive), red (negative)",
      "Check rank change arrows next to ranks (up/down/no change)",
      "Toggle '7 Days' filter",
      "Verify table re-sorts by 7d ROI",
      "Toggle '30 Days' filter",
      "Verify table re-sorts by 30d ROI",
      "Toggle back to 'All Time'",
      "Click a trader name in the table",
      "Verify navigates to /traders/[address]",
    ],
    expectedOutcome: "Leaderboard displays ranked traders with medals, color-coded scores, rank changes, and working time filters",
  },
  {
    name: "Vault Detail Page",
    steps: [
      "Navigate to /vault/[id]",
      "Verify back link navigates to /traders",
      "Verify vault header with name, trader, explorer link",
      "Verify 'Subscribe' button (if wallet connected)",
      "Verify 4 stat cards: Total Allocated, Followers, 30d ROI, Fee",
      "Verify ROI card is green if positive, red if negative",
      "Verify Strategy & Details section shows: risk level badge, min/max allocation, max drawdown",
      "Verify strategy description text is visible if available",
    ],
    expectedOutcome: "Vault detail page shows complete vault profile with stats, strategy, and subscribe CTA",
  },
];

// ============================================================
// If running directly with ts-node, print the test scenarios
// ============================================================

const isMain = process.argv[1]?.endsWith("e2e-tests.ts");
if (isMain) {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║       Gradex E2E Test Scenarios                 ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  let totalSteps = 0;
  for (const scenario of TEST_SCENARIOS) {
    console.log(`\n📋 ${scenario.name}`);
    console.log(`   Expected: ${scenario.expectedOutcome}`);
    scenario.steps.forEach((step, i) => {
      console.log(`   ${i + 1}. ${step}`);
    });
    totalSteps += scenario.steps.length;
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`📊 Total: ${TEST_SCENARIOS.length} scenarios, ${totalSteps} steps`);
  console.log(`${"=".repeat(50)}\n`);
  console.log("Run with Playwright: npx playwright test");
  console.log("Or manually follow the steps above.\n");
}

export { TEST_SCENARIOS, type TestScenario };
