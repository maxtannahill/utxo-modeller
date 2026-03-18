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
   git clone [https://github.com/yourusername/utxo-modeller.git](https://github.com/yourusername/utxo-modeller.git)
