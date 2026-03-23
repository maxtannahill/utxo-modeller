let currentDataset = [];
let currentDataSource = 'dummy'; 
let currentScriptType = { type: 'Native SegWit (P2WPKH)', vb: 68 }; 
let displayUnit = 'BTC'; 
let liveBtcPriceUSD = 0;
let isSweepMode = false; 

// New Heatmap Colors
const categories = [
    { id: 'Optimal', title: '< 0.01% Fee Impact', color: 'var(--tier-1)' },
    { id: 'Economical', title: '0.01% - 0.1% Fee Impact', color: 'var(--tier-2)' },
    { id: 'Marginal', title: '0.1% - 1% Fee Impact', color: 'var(--tier-3)' },
    { id: 'Expensive', title: '1% - 10% Fee Impact', color: 'var(--tier-4)' },
    { id: 'Uneconomical', title: '10% - 99.99% Fee Impact', color: 'var(--tier-5)' }, 
    { id: 'Unspendable', title: '> 99.99% Fee Impact', color: 'var(--tier-6)' }
];

function getApiBaseUrl() {
    let net = document.querySelector('input[name="network"]:checked').value;
    if(net === 'mainnet') return 'https://mempool.space/api';
    return `https://mempool.space/${net}/api`;
}

function getTxUrl(txid) {
    let net = document.querySelector('input[name="network"]:checked').value;
    if(net === 'mainnet') return `https://mempool.space/tx/${txid}`;
    return `https://mempool.space/${net}/tx/${txid}`;
}

document.querySelectorAll('input[name="network"]').forEach(radio => {
    radio.addEventListener('change', () => {
        if (currentDataSource !== 'dummy') {
            fetchRealUtxos();
        }
    });
});

function getAddressDetails(addr) {
    if (addr.startsWith('1') || addr.startsWith('m') || addr.startsWith('n')) return { type: 'Legacy (P2PKH)', vb: 148 };
    if (addr.startsWith('3') || addr.startsWith('2')) return { type: 'Nested SegWit (P2SH)', vb: 91 };
    if (addr.length === 42 || addr.length === 44) return { type: 'Native SegWit (P2WPKH)', vb: 68 };
    if (addr.length === 62 || addr.length === 64) return { type: 'SegWit Script (P2WSH)', vb: 105 };
    if (addr.startsWith('bc1p') || addr.startsWith('tb1p')) return { type: 'Taproot (P2TR)', vb: 58 };
    return { type: 'Native SegWit (P2WPKH)', vb: 68 }; 
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// --- NEW CSV IMPORT LOGIC ---
function importCSV() {
    const text = document.getElementById('csv-input').value.trim();
    if (!text) return alert("Please paste some data into the text box first.");
    
    const lines = text.split('\n');
    let validRows = [];
    
    lines.forEach(line => {
        const parts = line.split(/[\t,]/);
        if (parts.length >= 2) {
            const size = parseFloat(parts[0].replace(/[^0-9.]/g, ''));
            const count = parseInt(parts[1].replace(/[^0-9]/g, ''), 10);
            if (!isNaN(size) && !isNaN(count) && size > 0 && count > 0) {
                validRows.push({size, count});
            }
        }
    });
    
    if (validRows.length === 0) {
        return alert("Could not parse any valid Size and Count pairs. Ensure format is: Size, Count");
    }
    
    const tbody = document.getElementById('utxo-tbody');
    tbody.innerHTML = ''; 
    
    validRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><input type="number" step="any" value="${row.size}" class="btc-size" style="width:100%"></td><td><input type="number" value="${row.count}" class="utxo-count" style="width:100%"></td><td><button class="btn-remove" onclick="removeRow(this)">✕</button></td>`;
        tbody.appendChild(tr);
    });
    
    document.getElementById('csv-input').value = ''; 
}

async function fetchBtcPrice() {
    try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
        const data = await response.json();
        liveBtcPriceUSD = parseFloat(data.price);
        window.triggerSim();
    } catch (e) {
        try {
            const fallback = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
            const fallbackData = await fallback.json();
            liveBtcPriceUSD = fallbackData.bitcoin.usd;
            window.triggerSim();
        } catch (err) {}
    }
}

async function fetchLiveMempoolFee() {
    let btn = document.getElementById('btn-fetch-fee');
    if(btn) btn.innerText = "Fetching...";
    try {
        const response = await fetch(`${getApiBaseUrl()}/v1/fees/recommended`);
        const data = await response.json();
        if(data && data.fastestFee) {
            document.getElementById('fee-label-text').innerText = 'Live Network Fee';
            let slider = document.getElementById('fee-slider');
            slider.value = data.fastestFee;
            renderDashboard(data.fastestFee);
            window.triggerSim();
        }
    } catch(e) {}
    if(btn) btn.innerText = "⟳ Fetch Live Mempool Fee";
}

async function fetchRealUtxos() {
    let rawInput = document.getElementById('btc-address-input').value.trim();
    if (!rawInput) return alert("Please enter at least one valid Bitcoin address.");
    
    let addrs = rawInput.split(',').map(a => a.trim()).filter(a => a);
    let baseUrl = getApiBaseUrl();
    
    try {
        document.getElementById('tx-manifest-title').innerHTML = `<span>Fetching Live Data...</span> <div><a href="#top" class="anchor-link">↑</a><a href="#utxo-treemap-section" class="anchor-link">↓</a></div>`;
        
        let allUtxos = [];
        for (let addr of addrs) {
            const response = await fetch(`${baseUrl}/address/${addr}/utxo`);
            if (!response.ok) continue; 
            const utxos = await response.json();
            let scriptType = getAddressDetails(addr);
            
            utxos.forEach(u => {
                let d = u.status.block_time ? new Date(u.status.block_time * 1000) : new Date();
                let txLink = getTxUrl(u.txid);
                allUtxos.push({
                    id: `${u.txid}:${u.vout}`,
                    txid: u.txid,
                    vout: u.vout,
                    display_id: `<a href="${txLink}" target="_blank" style="color:var(--brand-mid); text-decoration:none;">${u.txid}:${u.vout}</a>`, 
                    short_id: `${u.txid.substring(0,8)}...${u.txid.substring(56)}:${u.vout}`, 
                    amount_sats: u.value,
                    date_obj: d,
                    date_str: formatDate(d),
                    vByteSize: scriptType.vb,
                    source_address: addr
                });
            });
        }
        
        if (allUtxos.length === 0) {
            alert("Failed to fetch UTXOs. Check address(es) or network selection.");
            document.getElementById('tx-manifest-title').innerHTML = `<span>Proposed Transaction</span> <div><a href="#top" class="anchor-link">↑</a><a href="#utxo-treemap-section" class="anchor-link">↓</a></div>`;
            return;
        }

        currentDataSource = addrs.length > 1 ? 'Multiple Addresses' : addrs[0];
        currentScriptType = addrs.length > 1 ? { type: 'Mixed Script Types' } : getAddressDetails(addrs[0]);
        
        currentDataset = allUtxos;
        isSweepMode = false;
        document.getElementById('fee-slider').max = 1000;
        autoSetTargetSpend50Percent();
        renderDashboard(document.getElementById('fee-slider').value);
        window.triggerSim();
    } catch(e) {
        alert("Error fetching address data.");
        document.getElementById('tx-manifest-title').innerHTML = `<span>Proposed Transaction</span> <div><a href="#top" class="anchor-link">↑</a><a href="#utxo-treemap-section" class="anchor-link">↓</a></div>`;
    }
}

function formatAmt(sats) {
    if (displayUnit === 'SATS') {
        return Math.round(sats).toLocaleString('en-US');
    }
    return (sats / 1e8).toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 });
}

function formatAmtClean(sats) {
    if (displayUnit === 'SATS') {
        return Math.round(sats).toLocaleString('en-US');
    }
    return parseFloat((sats / 1e8).toFixed(8)).toString();
}

function parseInputAmt(strVal) {
    return parseFloat(strVal.replace(/,/g, ''));
}

function getUnitStr() { return displayUnit === 'SATS' ? 'SATS' : 'BTC'; }

window.setUnit = function(unit) {
    if (displayUnit === unit) return;
    displayUnit = unit;
    
    document.getElementById('btn-unit-btc').className = unit === 'BTC' ? 'unit-btn active' : 'unit-btn';
    document.getElementById('btn-unit-sats').className = unit === 'SATS' ? 'unit-btn active' : 'unit-btn';
    
    let tsInput = document.getElementById('target-spend');
    let rawVal = parseInputAmt(tsInput.value || "0");
    
    if (unit === 'SATS') {
        tsInput.value = Math.round(rawVal * 1e8).toLocaleString('en-US');
    } else {
        tsInput.value = (rawVal / 1e8).toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 });
    }
    
    renderDashboard(document.getElementById('fee-slider').value);
    window.triggerSim();
};

document.getElementById('target-spend').addEventListener('input', function(e) {
    isSweepMode = false; 
    document.getElementById('fee-slider').max = 1000;
    
    let cleanVal = this.value.replace(/[^0-9.]/g, '');
    if (displayUnit === 'BTC') {
        if (cleanVal.includes('.')) {
            let parts = cleanVal.split('.');
            if (parts[1].length > 8) cleanVal = parts[0] + '.' + parts[1].substring(0, 8);
        }
        this.value = cleanVal;
    } else {
        cleanVal = cleanVal.replace(/\./g, '');
        this.value = cleanVal ? parseInt(cleanVal, 10).toLocaleString('en-US') : "";
    }
});

document.getElementById('target-outputs').addEventListener('input', function() {
    this.value = this.value.replace(/[^0-9]/g, ''); 
});

function generateTxId() {
    const chars = 'abcdef0123456789'; let txid = '';
    for(let i=0; i<64; i++) txid += chars[Math.floor(Math.random() * 16)];
    return txid;
}
function generateRandomDate(start, end) { return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())); }
function formatDate(date) { return date.toISOString().replace('T', ' ').substring(0, 16); }

function addRow() {
    const tbody = document.getElementById('utxo-tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><input type="number" step="any" value="0.0000" class="btc-size" style="width:100%"></td><td><input type="number" value="1" class="utxo-count" style="width:100%"></td><td><button class="btn-remove" onclick="removeRow(this)">✕</button></td>`;
    tbody.appendChild(tr);
}
function removeRow(btn) { btn.closest('tr').remove(); }

window.toggleGroup = function(groupId, headerRow) {
    headerRow.classList.toggle('expanded');
    let children = document.querySelectorAll(`.child-of-${groupId}`);
    children.forEach(child => { child.style.display = child.style.display === 'table-row' ? 'none' : 'table-row'; });
};

window.toggleTxSection = function(sectionId, chevronId) {
    let section = document.getElementById(sectionId);
    let chevron = document.getElementById(chevronId);
    if (section.style.display === 'none') {
        section.style.display = 'table';
        chevron.style.transform = 'rotate(90deg)';
    } else {
        section.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
};

function buildDatasetFromTable() {
    const sizes = document.querySelectorAll('.btc-size');
    const counts = document.querySelectorAll('.utxo-count');
    let dataset = [];
    const startDate = new Date(2022, 0, 1);
    const endDate = new Date();
    
    currentScriptType = { type: 'Native SegWit (P2WPKH)', vb: 68 }; 

    sizes.forEach((sizeInput, index) => {
        let sizeBTC = parseFloat(sizeInput.value);
        let count = parseInt(counts[index].value);
        
        if (sizeBTC > 0 && count > 0) {
            for (let i = 0; i < count; i++) {
                let d = generateRandomDate(startDate, endDate);
                let txid = generateTxId();
                let vout = Math.floor(Math.random() * 5);
                let shortId = `${txid.substring(0,8)}(...)${txid.substring(56)}:${vout}`;
                
                let dummyAddr = `bc1q....${Math.random().toString(36).substring(2,8)}`;
                
                dataset.push({
                    id: `${txid}:${vout}`,
                    txid: txid,
                    vout: vout,
                    display_id: shortId, 
                    short_id: shortId,
                    amount_sats: Math.round(sizeBTC * 100000000),
                    date_obj: d,
                    date_str: formatDate(d),
                    vByteSize: currentScriptType.vb,
                    source_address: dummyAddr
                });
            }
        }
    });
    currentDataSource = 'dummy';
    isSweepMode = false;
    document.getElementById('fee-slider').max = 1000;
    return dataset;
}

function autoSetTargetSpend50Percent() {
    let feeRate = parseFloat(document.getElementById('fee-slider').value) || 20;
    let spendableUtxos = currentDataset.filter(u => ((u.vByteSize * feeRate) / u.amount_sats) * 100 < 10);
    
    let netSpendable = 0;
    if(spendableUtxos.length > 0) {
        let inputVbSum = spendableUtxos.reduce((sum, u) => sum + u.vByteSize, 0);
        let txVBytes = 10.5 + inputVbSum + 31;
        let feeSats = Math.ceil(txVBytes * feeRate);
        let totalSats = spendableUtxos.reduce((sum, u) => sum + u.amount_sats, 0);
        netSpendable = Math.max(0, totalSats - feeSats);
    }
    
    let halfSats = Math.floor(netSpendable * 0.5);
    
    let tsInput = document.getElementById('target-spend');
    if (displayUnit === 'SATS') {
        tsInput.value = halfSats.toLocaleString('en-US');
    } else {
        tsInput.value = (halfSats / 1e8).toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 });
    }
}

function applyDummyData() {
    document.getElementById('btc-address-input').value = ''; 
    currentDataset = buildDatasetFromTable();
    closeModal('utxo-modal');
    autoSetTargetSpend50Percent();
    renderDashboard(document.getElementById('fee-slider').value);
    window.triggerSim();
}

function getMaxSweepFeeRate() {
    for (let f = 1000; f >= 1; f--) {
        let spendableUtxos = currentDataset.filter(u => ((u.vByteSize * f) / u.amount_sats * 100) < 10);
        if (spendableUtxos.length === 0) continue;
        let inputVbSum = spendableUtxos.reduce((sum, u) => sum + u.vByteSize, 0);
        let txVBytes = 10.5 + inputVbSum + 31; 
        let feeSats = Math.ceil(txVBytes * f);
        let totalSats = spendableUtxos.reduce((sum, u) => sum + u.amount_sats, 0);
        if (totalSats - feeSats > 0) return f;
    }
    return 1; 
}

window.spendAll = function() {
    isSweepMode = true;
    let slider = document.getElementById('fee-slider');
    let maxSlider = getMaxSweepFeeRate();
    slider.max = maxSlider;
    
    let feeRate = parseFloat(slider.value);
    if (feeRate > maxSlider) {
        feeRate = maxSlider;
        slider.value = feeRate;
    }

    executeSweepMath(feeRate);
};

function executeSweepMath(feeRate) {
    let spendableUtxos = currentDataset.filter(u => ((u.vByteSize * feeRate) / u.amount_sats * 100) < 10);
    if(spendableUtxos.length === 0) return;

    let inputVbSum = spendableUtxos.reduce((sum, u) => sum + u.vByteSize, 0);
    let txVBytes = 10.5 + inputVbSum + 31; 
    let feeSats = Math.ceil(txVBytes * feeRate);
    let maxSpend = spendableUtxos.reduce((sum, u) => sum + u.amount_sats, 0) - feeSats;

    if(maxSpend <= 0) return;

    document.getElementById('target-outputs').value = 1; 
    document.getElementById('coin-selection-strategy').value = 'largest'; 
    
    let tsInput = document.getElementById('target-spend');
    if (displayUnit === 'SATS') {
        tsInput.value = maxSpend.toLocaleString('en-US');
    } else {
        tsInput.value = (maxSpend / 1e8).toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 });
    }

    window.triggerSim();
}

function runBranchAndBound(utxos, targetSats, baseFeeSats, feeRateSatsPerByte) {
    let effUtxos = utxos.map(u => ({
        ...u,
        eff_val: u.amount_sats - (u.vByteSize * feeRateSatsPerByte)
    })).filter(u => u.eff_val > 0); 

    effUtxos.sort((a, b) => b.eff_val - a.eff_val);

    let exactTarget = targetSats + baseFeeSats;
    let bestSelection = null;
    let iterations = 0;
    const MAX_ITERATIONS = 50000; 
    
    let dynamicUnspendableLimit = Math.ceil((68 * feeRateSatsPerByte) / 0.9999);

    function search(depth, currentSum, currentSelection) {
        iterations++;
        if (iterations > MAX_ITERATIONS || bestSelection) return;

        if (currentSum >= exactTarget && currentSum <= exactTarget + dynamicUnspendableLimit) {
            bestSelection = [...currentSelection];
            return;
        }
        
        if (currentSum > exactTarget + dynamicUnspendableLimit) return;
        if (depth >= effUtxos.length) return;

        currentSelection.push(effUtxos[depth]);
        search(depth + 1, currentSum + effUtxos[depth].eff_val, currentSelection);
        currentSelection.pop();

        search(depth + 1, currentSum, currentSelection);
    }

    search(0, 0, []);
    return bestSelection;
}

function calculateSimulatedSpend(feeRate) {
    let targetRaw = parseInputAmt(document.getElementById('target-spend').value || "0");
    let rawNumOutputs = parseInt(document.getElementById('target-outputs').value);
    let strategy = document.getElementById('coin-selection-strategy').value;
    let detailsDiv = document.getElementById('tx-details-content');
    let badgeDiv = document.getElementById('tx-selection-badges');
    
    let targetSats = displayUnit === 'BTC' ? Math.round(targetRaw * 1e8) : Math.round(targetRaw);
    let dynamicUnspendableLimit = Math.ceil((68 * parseFloat(feeRate)) / 0.9999);

    let txTitleHtml = `<span>Proposed Transaction <span style="font-size: 12px; color: var(--text-muted); font-weight: normal; margin-left: 10px;">(Dummy Data)</span></span> <div><a href="#top" class="anchor-link">↑</a><a href="#utxo-treemap-section" class="anchor-link">↓</a></div>`;
    
    if (currentDataSource !== 'dummy') {
        if (currentDataSource === 'Multiple Addresses') {
            txTitleHtml = `<span>Proposed Transaction <span style="font-size: 14px; font-family: 'Ubuntu Mono', monospace; font-weight: normal; margin-left: 15px; letter-spacing: 1px; color: var(--brand-white);">Multiple Addresses</span> <span class="badge badge-grey" style="margin-left: 10px;">Mixed Script Types</span></span> <div><a href="#top" class="anchor-link">↑</a><a href="#utxo-treemap-section" class="anchor-link">↓</a></div>`;
        } else {
            let chunks = currentDataSource.toLowerCase().match(/.{1,4}/g) || [];
            let formattedAddr = chunks.map((c, i) => i % 2 === 0 ? `<span style="color: var(--brand-white)">${c}</span>` : `<span style="color: var(--text-muted)">${c}</span>`).join('');
            txTitleHtml = `<span>Proposed Transaction <span style="font-size: 14px; font-family: 'Ubuntu Mono', monospace; font-weight: normal; margin-left: 15px; letter-spacing: 1.5px;">${formattedAddr}</span> <span class="badge badge-grey" style="margin-left: 10px;">${currentScriptType.type}</span></span> <div><a href="#top" class="anchor-link">↑</a><a href="#utxo-treemap-section" class="anchor-link">↓</a></div>`;
        }
    }
    document.getElementById('tx-manifest-title').innerHTML = txTitleHtml;

    if (isNaN(targetRaw) || targetSats <= 0 || isNaN(rawNumOutputs) || rawNumOutputs < 1) {
        detailsDiv.innerHTML = "<p style='color: var(--text-muted); text-align: center;'>Awaiting valid parameters...</p>";
        badgeDiv.innerHTML = "";
        return;
    }
    
    if (targetSats <= dynamicUnspendableLimit) {
        detailsDiv.innerHTML = `<p style='color: var(--tier-5); text-align: center; font-weight: 600;'>Transaction Blocked</p><p style='text-align: center; color: var(--text-muted)'>Destination Output (${formatAmt(targetSats)} ${getUnitStr()}) is mathematically unspendable.</p>`;
        badgeDiv.innerHTML = "";
        return;
    }

    let selectedUtxos = [];
    let inputsUsed = 0;
    let txVBytes = 0;
    let feeSats = 0;
    let isExactMatch = false;
    let fallbackTriggered = false;
    
    let desiredOutputs = Math.max(1, rawNumOutputs);
    let assumedOutputs = desiredOutputs === 1 ? 2 : desiredOutputs; 

    if (strategy === 'bnb') {
        let baseTxVBytes = 10.5 + (1 * 31); 
        let baseFeeSats = Math.ceil(baseTxVBytes * parseFloat(feeRate));
        
        selectedUtxos = runBranchAndBound(currentDataset, targetSats, baseFeeSats, parseFloat(feeRate));
        
        if (selectedUtxos) {
            isExactMatch = true;
            inputsUsed = selectedUtxos.length;
            let inputVbSum = selectedUtxos.reduce((sum, u) => sum + u.vByteSize, 0);
            txVBytes = 10.5 + inputVbSum + (1 * 31);
            feeSats = Math.ceil(txVBytes * parseFloat(feeRate));
        } else {
            fallbackTriggered = true;
            strategy = 'largest'; 
        }
    }

    let accumulatedSats = 0;
    let changeSats = 0;
    let changeOutputCount = assumedOutputs - 1;

    if (strategy === 'largest' || strategy === 'oldest') {
        let sortedUtxos = [...currentDataset];
        if (strategy === 'largest') {
            sortedUtxos.sort((a, b) => b.amount_sats - a.amount_sats);
        } else if (strategy === 'oldest') {
            sortedUtxos.sort((a, b) => a.date_obj - b.date_obj);
        }

        let inputVbSum = 0;
        for (let i = 0; i < sortedUtxos.length; i++) {
            selectedUtxos.push(sortedUtxos[i]);
            accumulatedSats += sortedUtxos[i].amount_sats;
            inputVbSum += sortedUtxos[i].vByteSize;
            inputsUsed++;
            
            txVBytes = 10.5 + inputVbSum + (assumedOutputs * 31);
            feeSats = Math.ceil(txVBytes * parseFloat(feeRate));
            
            if (accumulatedSats >= (targetSats + feeSats)) break;
        }

        if (accumulatedSats < (targetSats + feeSats)) {
            selectedUtxos = null; 
        } else {
            changeSats = accumulatedSats - targetSats - feeSats;
            
            if (changeOutputCount > 0) {
                while (changeOutputCount > 0) {
                    let perChange = Math.floor(changeSats / changeOutputCount);
                    if (perChange > dynamicUnspendableLimit) break; 
                    
                    changeOutputCount--;
                    txVBytes = 10.5 + inputVbSum + ((1 + changeOutputCount) * 31);
                    feeSats = Math.ceil(txVBytes * parseFloat(feeRate));
                    changeSats = accumulatedSats - targetSats - feeSats;
                }
            } else if (changeSats > dynamicUnspendableLimit) {
                changeOutputCount = 1;
                txVBytes = 10.5 + inputVbSum + ((1 + changeOutputCount) * 31);
                feeSats = Math.ceil(txVBytes * parseFloat(feeRate));
                changeSats = accumulatedSats - targetSats - feeSats;
            }

            if (changeOutputCount === 0 && changeSats > 0) {
                feeSats += changeSats;
                changeSats = 0;
            }
        }
    } else if (isExactMatch) {
        accumulatedSats = selectedUtxos.reduce((sum, u) => sum + u.amount_sats, 0);
        changeSats = 0;
        changeOutputCount = 0;
        feeSats = accumulatedSats - targetSats; 
    }

    let usdString = liveBtcPriceUSD > 0 ? ` <span class="usd-fee">(~$${((feeSats / 1e8) * liveBtcPriceUSD).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})})</span>` : "";
    let totalUsdString = liveBtcPriceUSD > 0 ? `<br><span class="usd-fee" style="margin-left:0;">(~$${((accumulatedSats / 1e8) * liveBtcPriceUSD).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})})</span>` : "";

    if (selectedUtxos) {
        let strategyName = strategy === 'largest' ? "Largest First" : (strategy === 'oldest' ? "Oldest First" : "Branch & Bound");
        let finalNumOutputs = 1 + changeOutputCount;
        let feePct = (feeSats / accumulatedSats) * 100;

        badgeDiv.innerHTML = `<span class="badge badge-grey" style="color:var(--brand-white);">Strategy: ${strategyName}</span>`;
        if (isSweepMode) badgeDiv.innerHTML += ` <span class="badge badge-grey" style="color:var(--text-muted);">Sweep All Mode Active</span>`;
        
        if (isExactMatch) {
            badgeDiv.innerHTML += ` <span class="badge badge-green">Exact Match Found (0 Change)</span>`;
        } else if (fallbackTriggered) {
            badgeDiv.innerHTML += ` <span class="badge" style="background: rgba(239, 68, 68, 0.15); border: 1px solid var(--tier-5); color: var(--tier-5);">B&B Failed: Fallback to Largest</span>`;
        }

        if (changeOutputCount < (assumedOutputs - 1) && !isExactMatch && !isSweepMode) {
            badgeDiv.innerHTML += ` <span class="badge" style="background: rgba(239, 68, 68, 0.15); border: 1px solid var(--tier-5); color: var(--tier-5);">Outputs Consolidated (>99.99% Impact Filtered)</span>`;
        }

        let breakdown = {
            'Optimal': {count: 0, color: 'var(--tier-1)'},
            'Economical': {count: 0, color: 'var(--tier-2)'},
            'Marginal': {count: 0, color: 'var(--tier-3)'},
            'Expensive': {count: 0, color: 'var(--tier-4)'},
            'Uneconomical': {count: 0, color: 'var(--tier-5)'},
            'Unspendable': {count: 0, color: 'var(--tier-6)'}
        };

        let inputsHtml = '';
        selectedUtxos.forEach(u => {
            let costToSpendSats = u.vByteSize * parseFloat(feeRate);
            let feeImpactPct = (costToSpendSats / u.amount_sats) * 100;
            
            let status = ''; let color = '';
            if (feeImpactPct > 99.99) { status = 'Unspendable'; color = 'var(--tier-6)'; breakdown['Unspendable'].count++; }
            else if (feeImpactPct >= 10) { status = 'Uneconomical'; color = 'var(--tier-5)'; breakdown['Uneconomical'].count++; }
            else if (feeImpactPct >= 1) { status = 'Expensive'; color = 'var(--tier-4)'; breakdown['Expensive'].count++; }
            else if (feeImpactPct >= 0.1) { status = 'Marginal'; color = 'var(--tier-3)'; breakdown['Marginal'].count++; }
            else if (feeImpactPct >= 0.01) { status = 'Economical'; color = 'var(--tier-2)'; breakdown['Economical'].count++; }
            else { status = 'Optimal'; color = 'var(--tier-1)'; breakdown['Optimal'].count++; }

            inputsHtml += `<tr>
                <td class="utxo-id-cell" style="padding-left:10px !important;">${u.display_id}</td>
                <td style="font-size: 11px; font-weight: 600; color: ${color}; text-align: center;">${status}</td>
                <td style="text-align: right; color: var(--text-muted);">${u.vByteSize} vB</td>
                <td class="utxo-amount-cell" style="text-align: right;">${formatAmt(u.amount_sats)}</td>
            </tr>`;
        });

        let summaryArr = [];
        ['Optimal', 'Economical', 'Marginal', 'Expensive', 'Uneconomical', 'Unspendable'].forEach(k => {
            if(breakdown[k].count > 0) {
                let perc = Math.round((breakdown[k].count / inputsUsed) * 100);
                summaryArr.push(`<span style="color: ${breakdown[k].color}; font-weight: 600;">${k} ${perc}%</span>`);
            }
        });
        let summaryHtml = `<div style="font-size: 12px; padding: 8px 12px; background: var(--bg-input); border-radius: 4px; margin-bottom: 10px; border: 1px solid var(--border-color);">Composition: ${summaryArr.join(' <span style="color:var(--text-muted)">|</span> ')}</div>`;

        let outputsHtml = `<tr>
            <td colspan="2" style="font-size: 13px; color: var(--brand-white); padding-left: 10px;">Output #1 <span style="color: var(--text-muted); font-size: 11px; margin-left: 5px;">[Target Spend]</span></td>
            <td style="text-align: right; color: var(--text-muted);">31 vB</td>
            <td class="utxo-amount-cell" style="color: var(--brand-white); text-align: right;">${formatAmt(targetSats)}</td>
        </tr>`;

        if (changeOutputCount > 0) {
            let perChangeSat = Math.floor(changeSats / changeOutputCount);
            let changeRemainder = changeSats % changeOutputCount;

            for (let i = 0; i < changeOutputCount; i++) {
                let outSats = perChangeSat + (i === 0 ? changeRemainder : 0);
                outputsHtml += `<tr>
                    <td colspan="2" style="font-size: 13px; color: var(--brand-white); padding-left: 10px;">Output #${i+2} <span style="color: var(--text-muted); font-size: 11px; margin-left: 5px;">[Change]</span></td>
                    <td style="text-align: right; color: var(--text-muted);">31 vB</td>
                    <td class="utxo-amount-cell" style="color: var(--text-muted); text-align: right;">${formatAmt(outSats)}</td>
                </tr>`;
            }
        }

        let droppedOutputs = (assumedOutputs - 1) - changeOutputCount;
        if (droppedOutputs > 0 && !isSweepMode) {
            let reason = isExactMatch ? "Dropped by Branch & Bound" : "Consolidated by Engine";
            outputsHtml += `<tr>
                <td colspan="2" style="font-size: 13px; color: var(--text-muted); padding-left: 10px; text-decoration: line-through;">Outputs #${finalNumOutputs + 1} to #${finalNumOutputs + droppedOutputs} <span style="font-size: 11px; margin-left: 5px;">[${reason}]</span></td>
                <td style="text-align: right; color: var(--text-muted); text-decoration: line-through;">0 vB</td>
                <td class="utxo-amount-cell" style="color: var(--text-muted); text-decoration: line-through; text-align: right;">0</td>
            </tr>`;
        }

        detailsDiv.innerHTML = `
            <div class="tx-section-title" onclick="toggleTxSection('tx-inputs-table', 'chevron-inputs')">
                <span id="chevron-inputs" class="chevron" style="transform: rotate(0deg); display: inline-block; transition: transform 0.2s;">▶</span> 
                Inputs (${inputsUsed.toLocaleString('en-US')})
            </div>
            ${summaryHtml}
            <table id="tx-inputs-table" style="margin-bottom: 0; display: none; width: 100%;">
                ${inputsHtml}
            </table>
            
            <div class="tx-section-title" style="margin-top: 15px;" onclick="toggleTxSection('tx-outputs-table', 'chevron-outputs')">
                <span id="chevron-outputs" class="chevron expanded" style="transform: rotate(90deg); display: inline-block; transition: transform 0.2s;">▶</span> 
                Outputs (${finalNumOutputs.toLocaleString('en-US')})
            </div>
            <table id="tx-outputs-table" style="margin-bottom: 0; display: table; width: 100%;">
                ${outputsHtml}
            </table>

            <div style="display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px dashed var(--border-color);">
                <div>
                    <span style="color: var(--text-muted);">Base Overhead:</span> <strong style="color: var(--brand-white);">10.5 vB</strong><br>
                    <span style="color: var(--text-muted);">Total Size:</span> <strong style="color: var(--brand-white);">${txVBytes.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1})} vB</strong><br>
                    <span style="color: var(--text-muted);">Miner Fee:</span> <strong style="color: var(--brand-white);">${feeSats.toLocaleString('en-US')} sats (${(feeSats/1e8).toFixed(8)} BTC)</strong>${usdString}<br>
                    <span style="color: var(--text-muted);">Fee Impact:</span> <strong style="color: var(--brand-white);">${feePct.toFixed(4)}%</strong>
                </div>
                <div style="text-align: right;">
                    <span style="color: var(--text-muted);">Total Input:</span><br>
                    <strong style="color: var(--brand-white); font-family: 'Ubuntu Mono', monospace; font-size: 20px;">${formatAmt(accumulatedSats)}</strong> <span style="font-size: 12px; color: var(--text-muted);">${getUnitStr()}</span>
                    ${totalUsdString}
                </div>
            </div>
        `;

    } else {
        badgeDiv.innerHTML = "";
        detailsDiv.innerHTML = `<p style="text-align: center; color: var(--tier-5); padding: 20px; font-weight: 600;">Insufficient Funds.<br><span style="color: var(--text-muted); font-weight: normal;">Cannot meet target + fees with current wallet balance.</span></p>`;
    }
}

function buildGroupedTableHTML(groupData, highlightColor) {
    let html = '';
    let sizes = Object.keys(groupData).sort((a, b) => b - a);
    if (sizes.length === 0) return '';

    sizes.forEach((size) => {
        let data = groupData[size];
        let groupId = Math.random().toString(36).substr(2, 9);
        
        html += `
            <tr class="group-header" onclick="toggleGroup('${groupId}', this)">
                <td style="font-weight: 600;"><span class="chevron">▶</span><span class="utxo-amount-cell">${formatAmtClean(parseFloat(size))}</span></td>
                <td>${data.count.toLocaleString('en-US')} UTXOs</td>
                <td style="color: ${highlightColor}; font-weight: 600;">~${data.impact.toFixed(4)}%</td>
            </tr>
        `;
        
        data.utxos.forEach(u => {
            html += `
                <tr class="group-child child-of-${groupId}">
                    <td class="utxo-id-cell">${u.display_id}</td>
                    <td class="sub-text" style="font-size: 10px; color: var(--brand-white);">${u.date_str.substring(0,10)}</td>
                    <td class="sub-text" style="color: var(--text-muted);">${data.impact.toFixed(4)}%</td>
                </tr>
            `;
        });
    });
    return html;
}

function renderDashboard(feeRate) {
    document.getElementById('fee-val').innerText = feeRate;
    
    // Hide inspector on re-render to reset state
    document.getElementById('utxo-inspector').style.display = 'none';

    let totalBalanceSats = 0;
    let trappedCount = 0;
    
    let ids = ['Wallet'];
    let labels = ['<span style="color: var(--brand-white); font-weight: 800; font-size: 26px; font-family: \'Ubuntu\', sans-serif;">Total Wallet</span>'];
    let parents = [''];
    let values = [0]; 
    
    let markerColors = ['rgba(0,0,0,0)'];
    let customdata = [{addr: '', id: '', date: '', status: ''}];

    let groupedData = {};
    categories.forEach(cat => {
        groupedData[cat.id] = {};
        ids.push(cat.id);
        labels.push(`<span style="color:${cat.color}; font-weight:bold; font-size:18px; font-family: \'Ubuntu\', sans-serif;">${cat.id}</span><br><span style='font-size:11px; color:var(--brand-white); font-family: \'Ubuntu\', sans-serif;'>${cat.title}</span>`);
        parents.push('Wallet');
        values.push(0);
        markerColors.push('#17171C'); 
        customdata.push({addr: '', id: '', date: '', status: cat.id});
    });

    currentDataset.forEach(utxo => {
        totalBalanceSats += utxo.amount_sats;
        
        let costToSpendSats = utxo.vByteSize * feeRate;
        let feeImpactPct = (costToSpendSats / utxo.amount_sats) * 100;
        
        let targetSection, targetColor;
        
        if (feeImpactPct > 99.99) {
            targetSection = 'Unspendable'; targetColor = 'var(--tier-6)'; trappedCount++;
        } else if (feeImpactPct >= 10) {
            targetSection = 'Uneconomical'; targetColor = 'var(--tier-5)'; trappedCount++;
        } else if (feeImpactPct >= 1) {
            targetSection = 'Expensive'; targetColor = 'var(--tier-4)'; 
        } else if (feeImpactPct >= 0.1) {
            targetSection = 'Marginal'; targetColor = 'var(--tier-3)'; 
        } else if (feeImpactPct >= 0.01) {
            targetSection = 'Economical'; targetColor = 'var(--tier-2)'; 
        } else {
            targetSection = 'Optimal'; targetColor = 'var(--tier-1)'; 
        }

        if (!groupedData[targetSection][utxo.amount_sats]) {
            groupedData[targetSection][utxo.amount_sats] = { count: 0, impact: feeImpactPct, utxos: [] };
        }
        groupedData[targetSection][utxo.amount_sats].count++;
        groupedData[targetSection][utxo.amount_sats].utxos.push(utxo);

        ids.push(utxo.id);
        
        labels.push(`<b><span style="color:${targetColor}; font-family: 'Ubuntu Mono', monospace; font-size: 24px;">${formatAmtClean(utxo.amount_sats)}</span></b>`);
        
        parents.push(targetSection);
        values.push(utxo.amount_sats);
        markerColors.push('#121212'); 

        customdata.push({
            addr: utxo.source_address,
            id: utxo.short_id,
            date: utxo.date_str.substring(0,10),
            status: targetSection,
            exact_amt: formatAmtClean(utxo.amount_sats)
        });
    });

    let spendableUtxosForNet = currentDataset.filter(u => ((u.vByteSize * feeRate) / u.amount_sats) * 100 < 10);
    let netSpendable = 0;
    if(spendableUtxosForNet.length > 0) {
        let inputVbSum = spendableUtxosForNet.reduce((sum, u) => sum + u.vByteSize, 0);
        let txVBytes = 10.5 + inputVbSum + 31; 
        let feeSats = Math.ceil(txVBytes * feeRate);
        let totalSats = spendableUtxosForNet.reduce((sum, u) => sum + u.amount_sats, 0);
        netSpendable = Math.max(0, totalSats - feeSats);
    }

    document.getElementById('summary-metrics').innerHTML = `
        <div class="metric-card" style="border-top-color: var(--brand-white);">
            <h3>Total Balance</h3>
            <p style="font-family: 'Ubuntu Mono', monospace;">${formatAmt(totalBalanceSats)} <span class="metric-unit">${getUnitStr()}</span></p>
        </div>
        <div class="metric-card" style="border-top-color: var(--tier-1);">
            <h3>Net Spendable (< 10% fee)</h3>
            <p style="font-family: 'Ubuntu Mono', monospace;">${formatAmt(netSpendable)} <span class="metric-unit">${getUnitStr()}</span></p>
        </div>
        <div class="metric-card" style="border-top-color: var(--text-muted);">
            <h3>Total UTXOs</h3>
            <p style="color: var(--brand-white); font-family: 'Ubuntu Mono', monospace;">${currentDataset.length.toLocaleString('en-US')}</p>
        </div>
        <div class="metric-card" style="border-top-color: var(--tier-5);">
            <h3>Trapped UTXOs (≥ 10% fee)</h3>
            <p style="color: var(--brand-white); font-family: 'Ubuntu Mono', monospace;">${trappedCount.toLocaleString('en-US')}</p>
        </div>
    `;

    let tablesHTML = '';
    categories.forEach(cat => {
        let catData = groupedData[cat.id];
        let rowHTML = buildGroupedTableHTML(catData, cat.color);
        
        if (rowHTML === '') {
            rowHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color: var(--text-muted);">0 UTXOs in this tier.</td></tr>`;
        }
        
        let arrowsHtml = '';
        if (cat.id === 'Optimal') {
            arrowsHtml = `<a href="#utxo-treemap-section" class="anchor-link" style="float: right;">↑</a>`;
        }

        tablesHTML += `
            <div class="visual-container" id="${cat.id}-section">
                <h2 style="color: ${cat.color}; display:flex; justify-content: space-between; align-items: center;">
                    <span>${cat.id} UTXOs</span>
                    ${arrowsHtml}
                </h2>
                <p style="font-size: 13px; color: var(--text-muted); margin-top: -10px; margin-bottom: 15px;">
                    ${cat.title}
                </p>
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Size Group / ID</th>
                                <th>Count / Date</th>
                                <th>Fee Impact</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });
    document.getElementById('tables-grid').innerHTML = tablesHTML;

    let hovertemplates = [];
    for (let i=0; i<ids.length; i++) {
        if (parents[i] === '' || parents[i] === 'Wallet') {
            hovertemplates.push("%{label}<extra></extra>");
        } else {
            // Minimised hover template
            hovertemplates.push(`<b>%{customdata.exact_amt}</b> BTC<br>%{customdata.status}<extra></extra>`);
        }
    }

    let data = [{
        type: "treemap",
        ids: ids,
        labels: labels,
        parents: parents,
        values: values,
        customdata: customdata,
        hovertemplate: hovertemplates,
        marker: { colors: markerColors, line: { width: 1, color: '#3F3F46' } },
        textinfo: "label",
        textposition: "middle center",
        pathbar: { visible: false }
    }];
    
    let layout = { 
        margin: {l: 0, r: 0, b: 0, t: 0},
        font: { family: 'Ubuntu, sans-serif' },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        hoverlabel: { font: { family: 'Ubuntu, sans-serif' } }
    };
    Plotly.react('utxo-treemap', data, layout, {responsive: true, displayModeBar: false});
}

async function initDashboard() {
    currentDataset = buildDatasetFromTable(); 
    fetchBtcPrice(); 
    
    document.getElementById('fee-label-text').innerText = 'Manual Network Fee';
    document.getElementById('fee-slider').value = 350;

    renderDashboard(350); 
    
    if(document.getElementById('target-spend').value === "") {
        autoSetTargetSpend50Percent();
    } 
    window.triggerSim();
    
    // UTXO Click Inspector Logic
    let myPlot = document.getElementById('utxo-treemap');
    myPlot.on('plotly_click', function(data) {
        let pt = data.points[0];
        if (pt && pt.customdata && pt.customdata.id) {
            document.getElementById('inspector-addr').innerText = pt.customdata.addr;
            
            let txidFull = pt.customdata.id;
            let txidHash = txidFull.split(':')[0];
            let net = document.querySelector('input[name="network"]:checked').value;
            let txLink = net === 'mainnet' ? `https://mempool.space/tx/${txidHash}` : `https://mempool.space/${net}/tx/${txidHash}`;
            
            if (currentDataSource === 'dummy') {
                document.getElementById('inspector-txid').innerText = txidFull;
            } else {
                document.getElementById('inspector-txid').innerHTML = `<a href="${txLink}" target="_blank" style="color: var(--primary-blue); text-decoration: underline;">${txidFull}</a>`;
            }
            
            document.getElementById('inspector-date').innerText = pt.customdata.date;
            document.getElementById('inspector-amt').innerText = pt.customdata.exact_amt + " " + getUnitStr();
            document.getElementById('inspector-status').innerText = "Status: " + pt.customdata.status;
            
            document.getElementById('utxo-inspector').style.display = 'block';
        }
    });
    
    const resizeObserver = new ResizeObserver(() => {
        if (document.getElementById('utxo-treemap').data) {
            Plotly.Plots.resize('utxo-treemap');
        }
    });
    resizeObserver.observe(document.querySelector('.main-content'));
}

window.triggerSim = function() {
    calculateSimulatedSpend(document.getElementById('fee-slider').value);
};

['input', 'change', 'keyup'].forEach(evt => {
    document.getElementById('target-outputs').addEventListener(evt, window.triggerSim);
});

document.getElementById('coin-selection-strategy').addEventListener('change', window.triggerSim);

document.getElementById('fee-slider').addEventListener('input', (e) => {
    document.getElementById('fee-label-text').innerText = 'Manual Network Fee';
    if (isSweepMode) executeSweepMath(parseFloat(e.target.value));
    renderDashboard(e.target.value);
    window.triggerSim();
});

initDashboard();
