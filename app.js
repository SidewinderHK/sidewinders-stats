// Sidewinders Stats Execution Core Engine Matrix
class SidewindersStats {
    constructor() {
        this.gameLog = [];
        this.leagueTable = [];
        this.players = [];
        this.adminDraftConfiguration = []; // Temporarily manages live uncommitted records
        this.adminRosterArray = [];       // Persists localized name arrays inside localStorage
        
        $(document).ready(() => {
            this.init();
        });
    }
    
    async init() {
        try {
            await this.loadAllData();
            this.calculateLeagueTable();
            this.initLeagueTable();
            this.initPlayerSelector();
            this.updateLastUpdated();
            this.loadLocalAdminRosterCache();
        } catch (error) {
            console.error('Initialization error occurred:', error);
            alert('Failed to load standard core dataset structures safely.');
        }
    }
    
    async loadAllData() {
        try {
            const gameLogCSV = await this.fetchCSV('GameLog.csv');
            this.gameLog = this.parseCSV(gameLogCSV);
            
            this.players = [...new Set(this.gameLog.map(row => row['Player']))]
                .filter(name => name && name.trim() !== '')
                .sort();
            
            console.log(`Loaded ${this.gameLog.length} game records`);
            console.log(`Found ${this.players.length} unique players`);
        } catch (error) {
            console.error('Error loading CSV file:', error);
            throw error;
        }
    }
    
    async fetchCSV(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.text();
    }
    
    parseCSV(text) {
        const lines = text.split(/\r?\n/);
        const result = [];
        const headers = lines[0].split(',').map(h => h.trim());
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const words = lines[i].split(',');
            const row = {};
            headers.forEach((header, index) => {
                row[header] = words[index] ? words[index].trim() : '';
            });
            result.push(row);
        }
        return result;
    }
    
    calculateLeagueTable() {
        const playerMap = {};
        
        this.gameLog.forEach(row => {
            const name = row['Player'];
            if (!name || name.trim() === '') return;
            
            if (!playerMap[name]) {
                playerMap[name] = { name, p: 0, w: 0, d: 0, l: 0, gls: 0, ast: 0, pts: 0 };
            }
            
            const stats = playerMap[name];
            stats.p += 1;
            
            const res = row['Result'] ? row['Result'].trim().toLowerCase() : '';
            if (res === 'win') { stats.w += 1; stats.pts += 3; }
            else if (res === 'draw') { stats.d += 1; stats.pts += 1; }
            else if (res === 'loss') { stats.l += 1; }
            
            stats.gls += parseInt(row['Gls']) || 0;
            stats.ast += parseInt(row['Ast']) || 0;
        });
        
        this.leagueTable = Object.values(playerMap).map(p => {
            p.ppg = p.p > 0 ? (p.pts / p.p).toFixed(2) : '0.00';
            p.winPct = p.p > 0 ? ((p.w / p.p) * 100).toFixed(1) : '0.0';
            return p;
        });
        
        // Default sort priority configuration mapping logic
        this.leagueTable.sort((a, b) => b.pts - a.pts || b.gls - a.gls || b.ast - a.ast);
    }
    
    initLeagueTable() {
        const tbody = document.getElementById('leagueTableBody');
        tbody.innerHTML = '';
        
        this.leagueTable.forEach((row, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${idx + 1}</strong></td>
                <td class="text-capitalize font-weight-bold text-primary" style="cursor:pointer;" onclick="window.sidewindersApp.selectPlayerFromTable('${row.name}')">${row.name}</td>
                <td>${row.p}</td>
                <td>${row.w}</td>
                <td>${row.d}</td>
                <td>${row.l}</td>
                <td>${row.gls}</td>
                <td>${row.ast}</td>
                <td><span class="badge bg-success p-2">${row.pts}</span></td>
                <td>${row.ppg}</td>
                <td>${row.winPct}%</td>
            `;
            tbody.appendChild(tr);
        });
        
        $('#leagueTable').DataTable({
            pageLength: 25,
            order: [[8, 'desc']],
            retrieve: true,
            responsive: true
        });
    }
    
    initPlayerSelector() {
        const select = document.getElementById('playerSelect');
        select.innerHTML = '<option value="">-- Choose Roster Option --</option>';
        
        this.players.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.innerText = p;
            select.appendChild(opt);
        });
        
        $(select).on('change', (e) => {
            this.renderIndividualPlayerAnalysis(e.target.value);
        });
    }
    
    selectPlayerFromTable(name) {
        document.getElementById('playerSelect').value = name;
        this.renderIndividualPlayerAnalysis(name);
        $('html, body').animate({ scrollTop: $('#analysis').offset().top - 20 }, 400);
    }
    
    updateLastUpdated() {
        if(this.gameLog.length > 0) {
            const finalRecord = this.gameLog[this.gameLog.length - 1];
            document.getElementById('lastUpdatedContainer').innerText = `Active Logs Count: ${this.gameLog.length} Row Entries | Current Game Index: #${finalRecord.ID || 'N/A'}`;
            // Set match input defaults securely matching sequence indexes
            const nextSuggestedId = (parseInt(finalRecord.ID) || 0) + 1;
            document.getElementById('matchIdField').value = nextSuggestedId;
        }
        document.getElementById('matchDateField').value = new Date().toISOString().split('T')[0];
    }

    renderIndividualPlayerAnalysis(name) {
        const container = document.getElementById('playerStatsOutput');
        if (!name) { container.classList.add('d-none'); return; }
        
        container.classList.remove('d-none');
        const pData = this.leagueTable.find(p => p.name === name) || { p:0, w:0, d:0, l:0, gls:0, ast:0, pts:0, ppg:'0.00', winPct:'0.0' };
        
        let historyHTML = '';
        this.gameLog.filter(row => row['Player'] === name).reverse().forEach(row => {
            historyHTML += `
                <div class="list-group-item d-flex justify-content-between align-items-center small">
                    <div>
                        <span class="badge ${row['Team'] === 'White' ? 'badge-team-white' : 'badge-team-colour'} me-2">${row['Team']}</span>
                        <span class="text-muted">${row['Date']} (Match #${row['ID']})</span>
                    </div>
                    <div>
                        <span class="fw-bold me-3 text-uppercase">${row['Result']}</span>
                        <span class="badge bg-secondary me-1">G: ${row['Gls'] || 0}</span>
                        <span class="badge bg-light text-dark border">A: ${row['Ast'] || 0}</span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="row g-3 mt-2">
                <div class="col-md-4 text-center bg-light p-3 rounded border">
                    <h3 class="text-capitalize mb-1 text-primary">${name}</h3>
                    <span class="badge bg-success mb-3 p-2">Form Rating: ${pData.ppg} PPG</span>
                    <div class="d-flex justify-content-around small">
                        <div><strong>Matches</strong><br>${pData.p}</div>
                        <div><strong>Goals</strong><br>${pData.gls}</div>
                        <div><strong>Assists</strong><br>${pData.ast}</div>
                    </div>
                </div>
                <div class="col-md-8">
                    <h6>Historic Track Performance (Newest First)</h6>
                    <div class="list-group shadow-sm border rounded" style="max-height: 240px; overflow-y:auto;">
                        ${historyHTML || '<div class="p-3 text-muted">No historical matches logged.</div>'}
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // LOCAL STORAGE ADMINISTRATIVE CONSOLE MODULE METHODS
    // =========================================================================
    loadLocalAdminRosterCache() {
        const storedRoster = localStorage.getItem('sidewinders_admin_pool');
        if (storedRoster) {
            this.adminRosterArray = JSON.parse(storedRoster);
        } else {
            this.adminRosterArray = [...this.players];
            localStorage.setItem('sidewinders_admin_pool', JSON.stringify(this.adminRosterArray));
        }
        this.renderRosterUIBadges();
    }

    renderRosterUIBadges() {
        document.getElementById('poolCounterCount').innerText = this.adminRosterArray.length;
        const display = document.getElementById('adminRosterBadgesDisplay');
        display.innerHTML = '';

        if(this.adminRosterArray.length === 0) {
            display.innerHTML = '<span class="text-muted small">No players cached yet. Import a file or write names to populate options.</span>';
            return;
        }

        this.adminRosterArray.forEach(name => {
            const span = document.createElement('span');
            span.className = "badge bg-dark p-2 d-flex align-items-center gap-2 text-capitalize";
            span.innerHTML = `${name} <i class="fa-solid fa-rectangle-xmark text-danger" style="cursor:pointer;" onclick="window.sidewindersApp.deleteRosterPlayer('${name}')"></i>`;
            display.appendChild(span);
        });
    }

    appendSingleRosterPlayer() {
        const input = document.getElementById('manualPlayerAddInput');
        const name = input.value.trim();
        if (name && !this.adminRosterArray.includes(name)) {
            this.adminRosterArray.push(name);
            this.adminRosterArray.sort();
            localStorage.setItem('sidewinders_admin_pool', JSON.stringify(this.adminRosterArray));
            input.value = '';
            this.renderRosterUIBadges();
        }
    }

    deleteRosterPlayer(name) {
        this.adminRosterArray = this.adminRosterArray.filter(p => p !== name);
        localStorage.setItem('sidewinders_admin_pool', JSON.stringify(this.adminRosterArray));
        this.renderRosterUIBadges();
    }

    clearFullStoredRosterPool() {
        if(confirm("Confirm action to completely drop active local pool roster indexes?")) {
            this.adminRosterArray = [];
            localStorage.removeItem('sidewinders_admin_pool');
            this.renderRosterUIBadges();
        }
    }

    bulkExtractPlayers(inputNode) {
        const file = inputNode.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const rawCSVLines = e.target.result.split(/\r?\n/);
            let extractedSet = new Set(this.adminRosterArray);

            for (let i = 1; i < rawCSVLines.length; i++) {
                if(!rawCSVLines[i].trim()) continue;
                const columns = rawCSVLines[i].split(',');
                if (columns[2] && columns[2].trim() !== '') {
                    extractedSet.add(columns[2].trim());
                }
            }

            this.adminRosterArray = Array.from(extractedSet).sort();
            localStorage.setItem('sidewinders_admin_pool', JSON.stringify(this.adminRosterArray));
            this.renderRosterUIBadges();
            alert("Roster successfully updated and prioritized using values found inside your log!");
        };
        reader.readAsText(file);
    }

    // --- Draft Parser Engine ---
    processDraftTextInput() {
        const textBlock = document.getElementById('rawDraftTextArea').value;
        const matchId = document.getElementById('matchIdField').value;
        const inputDate = document.getElementById('matchDateField').value;
        
        if(!textBlock.trim()) return alert("Please input team draft text info lines to parse layout configuration.");
        
        // Re-align date formatting back to standard DD/MM/YYYY database standard patterns
        const dSplit = inputDate.split('-');
        const finalizedDateString = `${dSplit[2]}/${dSplit[1]}/${dSplit[0]}`;

        this.adminDraftConfiguration = [];
        const lines = textBlock.split('\n');
        let operatingTeamContext = "";

        lines.forEach(rawLine => {
            let cleanRow = rawLine.trim();
            if(!cleanRow) return;

            if(cleanRow.toLowerCase().includes('white')) {
                operatingTeamContext = "White";
                return;
            } else if(cleanRow.toLowerCase().includes('colour') || cleanRow.toLowerCase().includes('color')) {
                operatingTeamContext = "Colour";
                return;
            }

            // Remove formatting like markdown bullet points, symbols, or numbers
            let clearedName = cleanRow.replace(/^[^a-zA-Z0-9]+/, "").replace(/[\d\.\-\)\(]+/g, "").trim();
            if(!clearedName) return;

            // Match back against player definitions to preserve normalized typing cases
            let matchedProfileName = this.adminRosterArray.find(
                item => item.toLowerCase() === clearedName.toLowerCase()
            ) || clearedName;

            if(operatingTeamContext) {
                this.adminDraftConfiguration.push({
                    id: matchId,
                    date: finalizedDateString,
                    player: matchedProfileName,
                    team: operatingTeamContext,
                    result: 'Win', // Baseline default assignment values
                    gls: 0, ast: 0, og: 0, pen: 0
                });
            }
        });

        this.buildLiveEditableStatMatrix();
        // Shift user context over to the newly generated table view
        const targetTabTrigger = document.querySelector('#stats-tab');
        const tabInstance = bootstrap.Tab.getOrCreateInstance(targetTabTrigger);
        tabInstance.show();
    }

    buildLiveEditableStatMatrix() {
        const tbody = document.getElementById('statInputTableBody');
        tbody.innerHTML = '';

        if(this.adminDraftConfiguration.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-muted py-4 small text-center">No sheet configuration found. Please paste and parse setups under the Draft panel.</td></tr>`;
            return;
        }

        this.adminDraftConfiguration.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-start font-weight-bold text-capitalize">${row.player}</td>
                <td><span class="badge ${row.team === 'White' ? 'badge-team-white' : 'badge-team-colour'}">${row.team}</span></td>
                <td>
                    <select class="form-select form-select-sm" onchange="window.sidewindersApp.updateGridElement(${index}, 'result', this.value)">
                        <option value="Win">Win</option>
                        <option value="Loss">Loss</option>
                        <option value="Draw">Draw</option>
                    </select>
                </td>
                <td><input type="number" class="form-control form-control-sm text-center" min="0" value="0" onchange="window.sidewindersApp.updateGridElement(${index}, 'gls', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" min="0" value="0" onchange="window.sidewindersApp.updateGridElement(${index}, 'ast', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" min="0" value="0" onchange="window.sidewindersApp.updateGridElement(${index}, 'og', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm text-center" min="0" value="0" onchange="window.sidewindersApp.updateGridElement(${index}, 'pen', this.value)"></td>
            `;
            tbody.appendChild(tr);
        });
    }

    updateGridElement(index, key, value) {
        if(key === 'result') {
            this.adminDraftConfiguration[index][key] = value;
        } else {
            this.adminDraftConfiguration[index][key] = parseInt(value) || 0;
        }
    }

    resetActiveGameSheetTable() {
        this.adminDraftConfiguration = [];
        this.buildLiveEditableStatMatrix();
    }

    exportCompiledMatchDataSnippet() {
        if(this.adminDraftConfiguration.length === 0) return alert("Grid mapping table contains no records to finalize.");

        let buildOutputBuffer = "";
        this.adminDraftConfiguration.forEach(row => {
            // Re-map explicit zero assignments down to clean blank fields matching core style sheets
            const gls = row.gls > 0 ? row.gls : "";
            const ast = row.ast > 0 ? row.ast : "";
            const og = row.og > 0 ? row.og : "";
            const pen = row.pen > 0 ? row.pen : "";

            buildOutputBuffer += `${row.id},${row.date},${row.player},${row.team},${row.result},${gls},${og},${ast},${pen},\n`;
        });

        // Trigger dynamic system browser downloadeable file attachment handling
        const downloadBlob = new Blob([buildOutputBuffer], { type: 'text/csv;charset=utf-8;' });
        const dummyNode = document.createElement("a");
        const trackingUrl = URL.createObjectURL(downloadBlob);
        
        dummyNode.setAttribute("href", trackingUrl);
        dummyNode.setAttribute("download", `Match_${this.adminDraftConfiguration[0].id}_Appends.csv`);
        dummyNode.style.visibility = 'hidden';
        document.body.appendChild(dummyNode);
        dummyNode.click();
        document.body.removeChild(dummyNode);

        // Advance layout defaults for future iterations automatically
        const oldId = parseInt(document.getElementById('matchIdField').value) || 0;
        document.getElementById('matchIdField').value = oldId + 1;
        document.getElementById('rawDraftTextArea').value = "";
        this.resetActiveGameSheetTable();
        
        alert("CSV chunk compiled and ready! Open this downloadeable file, copy the lines, and paste them onto the bottom of your master GameLog.csv file.");
    }
}

// Access Security Key Controllers
function toggleAdminPanel() {
    const inputToken = prompt("Enter Identity Pass Key Pin:");
    if (inputToken === "1984") { // Update matching your personalized environment key requirements
        $('#adminConsoleWrapper').removeClass('d-none');
        $('html, body').animate({ scrollTop: $('#adminConsoleWrapper').offset().top - 20 }, 400);
    } else if (inputToken !== null) {
        alert("Access Credentials Denied.");
    }
}

function lockAdminConsole() {
    $('#adminConsoleWrapper').addClass('d-none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function shareCurrentPlayer() {
    const pSelect = document.getElementById('playerSelect');
    const pName = pSelect.value;
    if (!pName) return alert('Select a profile first.');
    
    const targetUrl = new URL(window.location.href);
    targetUrl.hash = `player-${encodeURIComponent(pName)}`;
    
    navigator.clipboard.writeText(targetUrl.toString()).then(() => {
        alert(`Direct tracking profile link for ${pName} copied to clipboard successfully!`);
    });
}

// Global Core Application Instance Bindings
window.sidewindersApp = new SidewindersStats();
