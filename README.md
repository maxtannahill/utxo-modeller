# Unspent.to | UTXO Modeller

A visual simulation engine for custodians and advanced operators of Bitcoin wallets to analyse and optimise their Unspent Transaction Outputs (UTXOs).

Live deployment: [unspent.to](https://unspent.to)

## The Problem
When Bitcoin network fee rates spike, smaller UTXOs can become economically unspendable ("dust") because the data cost to unlock them exceeds their actual value. Treasury operators need a way to mathematically predict these fee impacts, visualize their wallet health, and strategically time their consolidations.

## The Solution
The UTXO Modeller is a fully client-side web application that fetches live network conditions, ingests wallet data, and simulates exact transaction builds using standard coin selection algorithms. 

It categorizes every UTXO into a 6-tier heatmap based on its required fee impact:
* **Optimal:** < 0.01% Fee Impact
* **Economical:** 0.01% - 0.1% Fee Impact
* **Marginal:** 0.1% - 1% Fee Impact
* **Expensive:** 1% - 10% Fee Impact
* **Uneconomical:** 10% - 99.99% Fee Impact
* **Unspendable (Dust):** > 99.99% Fee Impact

## Key Features
* **Live Network Sync:** Fetches real-time recommended fees and UTXO data via the [mempool.space](https://mempool.space/) API (Supports Mainnet, Testnet, Testnet4, and Signet).
* **Interactive Treemap:** A macro-visualization of wallet composition powered by Plotly.js.
* **Sandbox Mode:** Inject dummy data or paste directly from CSV/Excel to test algorithmic outcomes without exposing real public keys.
* **Transaction Simulation Engine:** Test how different algorithms build transactions under the hood, including:
  * Oldest First (FIFO)
  * Largest First
  * Branch and Bound (Zero-Change)
* **Anti-Dust Protections:** The simulation engine mathematically prevents the creation of unspendable change outputs by forcibly consolidating them into the miner fee if necessary.

## Getting Started

This project is built using a lightweight, dependency-free architecture. There are no build tools, no Node modules, and no servers to configure.

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/utxo-modeller.git
   ```
2. Navigate to the project directory:
   ```bash
   cd utxo-modeller
   ```
3. Open `index.html` in any modern web browser.

## Tech Stack
* **HTML5 / CSS3:** Structured for modern, responsive layouts using CSS Grid and Flexbox. Custom styling using a sleek grayscale/Ubuntu palette.
* **Vanilla JavaScript (ES6):** Handles all API fetching, math, algorithm execution, and DOM manipulation natively.
* **Plotly.js:** Utilized purely for the high-performance rendering of the Treemap SVG.

## Contributing

Contributions, issues, and feature requests are highly welcome! This tool is designed to be a utility for the broader Bitcoin community, and open-source collaboration is the best way to improve it.

### Recommended Areas for Contribution:
* **Export to PSBT:** Building a bridge to format the simulated "Proposed Transaction" into a valid BIP-174 Base64 PSBT string that can be imported directly into wallets like Sparrow or Electrum.
* **Additional Coin Selection Algos:** Implementing alternative strategies like Knapsack or Blackjack.
* **xPub/Descriptor Support:** Expanding the API fetcher to derive UTXOs from extended public keys rather than just single addresses.

### How to Contribute:
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

Please ensure your code remains lightweight and heavily avoids introducing unnecessary external NPM dependencies. The beauty of this tool is its ability to run cleanly in the browser.

## License

Distributed under the MIT License. See `LICENSE` for more information.
