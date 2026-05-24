// Sidewinders Stats - Fail-Safe Analytics Core
class SidewindersStats {
    constructor() {
        this.gameLog = [];
        this.leagueTable = [];
        this.players = [];
        this.selectedPlayer = null;
        
        // Explicitly define team sheet variables early to prevent look-up crashes
        this.currentWhiteTeam = [];
        this.currentColourTeam = [];
        
        $(document).ready(() => {
            this.init();
        });
    }
    
    async init() {
        try {
            this.showLoading(true);
            await this.loadAllData();
            this.calculateLeagueTable();
            this.initLeagueTable();
            this.initPlayerSelector();
            this.initTeamGenerator();
            this.updateLastUpdated();
            this.showLoading(false);
            
        } catch (error) {
            console.error('Initialization error encountered:', error);
            this.showError('Failed to load data. Please check GameLog.csv file alignment.');
            this.showLoading(false);
        }
    }
    
    async loadAllData() {
        try {
            const gameLogCSV = await this.fetchCSV('GameLog.csv');
            this.gameLog = this.parseCSV(gameLogCSV);
            
            // Collect unique player names safely
            this.players = [...new Set(this.gameLog.map(row => row['Player']))]
                .filter(name => name && name.trim() !== '')
                .sort();
            
            console.log(`Loaded ${this.gameLog.length} clean game records`);
            console.log(`Found ${this.players.length} unique active players`);
            
        } catch (error) {
            console.error('Error loading CSV file:', error);
            throw error;
        }
    }
    
    calculateLeagueTable() {
        const playerStats = {};
        
        this.gameLog.forEach(row => {
            const player = row['Player'];
            if (!player || player.trim() === '') return;
            
            if (!playerStats[player]) {
                playerStats[player] = {
                    Player: player,
                    Played: 0,
                    Wins: 0,
                    Draws: 0,
                    Losses: 0,
                    Goals: 0,
                    Assists: 0,
                    TotalPoints: 0
                };
            }
            
            const stats = playerStats[player];
            stats.Played += 1;
            
            const result = row['Result'] ? row['Result'].toLowerCase() : '';
            if (result === 'win') {
                stats.Wins += 1;
                stats.TotalPoints += 3;
            } else if (result === 'draw') {
                stats.Draws += 1;
                stats.TotalPoints += 1;
            } else if (result === 'loss') {
                stats.Losses += 1;
            }
            
            stats.Goals += parseInt(row['Gls']) || 0;
            stats.Assists += parseInt(row['Ast']) || 0;
        });
        
        this.leagueTable = Object.values(playerStats).map(player => {
            player.PPG = player.Played > 0 ? player.TotalPoints / player.Played : 0;
            player.WinPercent = player.Played > 0 ? (player.Wins / player.Played) * 100 : 0;
            return player;
        });
        
        // Sorting precedence rule logic (Pts -> Gls -> Ast)
        this.leagueTable.sort((a, b) => {
            if (b.TotalPoints !== a.TotalPoints) return b.TotalPoints - a.TotalPoints;
            if (b.Goals !== a.Goals) return b.Goals - a.Goals;
            return b.Assists - a.Assists;
        });
    }
    
    initLeagueTable() {
        const tbody = document.getElementById('standingsTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        
        this.leagueTable.forEach((row, index) => {
            const tr = document.createElement('tr');
            // Safely escape quotes and dynamic arguments for the inline click trigger
            const safePlayerName = row.Player.replace(/'/g, "\\'");
            
            tr.innerHTML = `
                <td class="text-center fw-bold text-muted">${index + 1}</td>
                <td class="clickable-player text-capitalize" onclick="window.sidewindersApp.selectPlayerFromTable('${safePlayerName}')">
                    <strong>${row.Player}</strong>
                </td>
                <td class="text-center">${row.Played}</td>
                <td class="text-center text-success fw-bold">${row.Wins}</td>
                <td class="text-center text-muted">${row.Draws}</td>
                <td class="text-center text-danger">${row.Losses}</td>
                <td class="text-center fw-bold">${row.Goals}</td>
                <td class="text-center text-secondary">${row.Assists}</td>
                <td class="text-center bg-light fw-bold text-dark">${row.TotalPoints}</td>
                <td class="text-center fw-bold text-primary">${row.PPG.toFixed(2)}</td>
                <td class="text-center font-monospace">${row.WinPercent.toFixed(1)}%</td>
            `;
            tbody.appendChild(tr);
        });
        
        if ($.fn.DataTable.isDataTable('#standingsTable')) {
            $('#standingsTable').DataTable().destroy();
        }
        
        $('#standingsTable').DataTable({
            pageLength: 25,
            order: [[8, 'desc']], 
            responsive: true,
            columnDefs: [
                { targets: [0, 8, 9, 10], orderSequence: ['desc', 'asc'] }
            ]
        });
    }
    
    initPlayerSelector() {
        const select = document.getElementById('playerSelect');
        if (!select) return;
        select.innerHTML = '<option value="">-- Choose Roster Option --</option>';
        
        this.players.forEach(player => {
            const option = document.createElement('option');
            option.value = player;
            option.text = player;
            select.appendChild(option);
        });
        
        $(select).off('change').on('change', (e) => {
            this.renderPlayerAnalysis(e.target.value);
        });
    }
    
    initTeamGenerator() {
        const container = $('#playerCheckboxContainer');
        if (!container.length) return;
        container.empty();
        
        this.players.forEach((player, idx) => {
            const rowData = this.leagueTable.find(p => p.Player === player);
            const ppg = rowData ? rowData.PPG : 0;
            const winPercent = rowData ? rowData.WinPercent : 0;
            const totalPoints = rowData ? rowData.TotalPoints : 0;
            
            const itemHtml = `
                <div class="col">
                    <div class="form-check p-2 border rounded bg-white h-100 d-flex align-items-center" style="cursor: pointer;">
                        <input class="form-check-input player-generator-check ms-1 me-2" type="checkbox" value="${player}" id="chk_player_${idx}" 
                            data-ppg="${ppg}" data-winpercent="${winPercent}" data-totalpoints="${totalPoints}">
                        <label class="form-check-label text-truncate small fw-bold flex-grow-1 user-select-none" for="chk_player_${idx}">
                            ${player}
                            <span class="text-muted font-monospace d-block small" style="font-size: 0.75rem;">PPG: ${ppg.toFixed(1)}</span>
                        </label>
                    </div>
                </div>
            `;
            container.append(itemHtml);
        });
        
        $('.player-generator-check').off('change').on('change', () => this.updateSelectedPlayersCount());
        
        $('#btnSelectAllPlayers').off('click').on('click', () => {
            $('.player-generator-check').prop('checked', true);
            this.updateSelectedPlayersCount();
        });
        
        $('#btnClearAllPlayers').off('click').on('click', () => {
            $('.player-generator-check').prop('checked', false);
            this.updateSelectedPlayersCount();
            $('#generatedTeamsArea').slideUp(200);
        });
        
        $('#btnGenerateTeams').off('click').on('click', () => this.generateBalancedTeams());
        $('#btnCopyTeamSheet').off('click').on('click', () => this.copyTeamSheetToClipboard());
    }
    
    updateSelectedPlayersCount() {
        const checkedCount = $('.player-generator-check:checked').length;
        $('#selectedPlayersCount').text(checkedCount);
        $('#btnGenerateTeams').prop('disabled', checkedCount < 2);
    }
    
    generateBalancedTeams() {
        const metric = $('#balancingMethod').val() || 'PPG';
        const selectedPlayers = [];
        
        $('.player-generator-check:checked').each(function() {
            selectedPlayers.push({
                name: $(this).val(),
                PPG: parseFloat($(this).data('ppg')) || 0,
                WinPercent: parseFloat($(this).data('winpercent')) || 0,
                TotalPoints: parseFloat($(this).data('totalpoints')) || 0
            });
        });
        
        if (selectedPlayers.length < 2) return;
        
        selectedPlayers.sort((a, b) => b[metric] - a[metric]);
        
        const whiteTeam = [];
        const colourTeam = [];
        let whiteSum = 0;
        let colourSum = 0;
        
        selectedPlayers.forEach(player => {
            if (whiteTeam.length > colourTeam.length + 1) {
                colourTeam.push(player);
                colourSum += player[metric];
            } else if (colourTeam.length > whiteTeam.length + 1) {
                whiteTeam.push(player);
                whiteSum += player[metric];
            } else {
                if (whiteSum <= colourSum) {
                    whiteTeam.push(player);
                    whiteSum += player[metric];
                } else {
                    colourTeam.push(player);
                    colourSum += player[metric];
                }
            }
        });
        
        const renderList = (element, collection) => {
            element.empty();
            collection.forEach(p => {
                element.append(`
                    <li class="list-group-item d-flex justify-content-between align-items-center py-2 px-3 fw-bold">
                        <span><i class="far fa-user me-2 text-muted small"></i>${p.name}</span>
                        <span class="badge bg-light text-dark border font-monospace text-secondary" style="font-size: 0.8rem;">${p[metric].toFixed(1)}</span>
                    </li>
                `);
            });
        };
        
        renderList($('#whiteTeamList'), whiteTeam);
        renderList($('#colourTeamList'), colourTeam);
        
        const whiteAvg = whiteTeam.length > 0 ? (whiteSum / whiteTeam.length) : 0;
        const colourAvg = colourTeam.length > 0 ? (colourSum / colourTeam.length) : 0;
        const difference = Math.abs(whiteAvg - colourAvg);
        
        let displayLabel = metric === 'PPG' ? 'Avg PPG' : (metric === 'WinPercent' ? 'Avg Win %' : 'Avg Pts');
        let displayUnit = metric === 'WinPercent' ? '%' : '';
        
        $('#whiteTeamMetric').text(`${displayLabel}: ${whiteAvg.toFixed(1)}${displayUnit}`);
        $('#colourTeamMetric').text(`${displayLabel}: ${colourAvg.toFixed(1)}${displayUnit}`);
        $('#teamsDiffMetric').text(difference.toFixed(1) + displayUnit);
        
        const diffBadge = $('#teamsDiffMetric').removeClass();
        if (difference <= 0.2 || (metric === 'WinPercent' && difference <= 5)) {
            diffBadge.addClass('badge bg-success fs-6 ms-1');
        } else if (difference <= 0.5 || (metric === 'WinPercent' && difference <= 12)) {
            diffBadge.addClass('badge bg-warning text-dark fs-6 ms-1');
        } else {
            diffBadge.addClass('badge bg-danger fs-6 ms-1');
        }
        
        this.currentWhiteTeam = whiteTeam;
        this.currentColourTeam = colourTeam;
        
        $('#generatedTeamsArea').slideDown(350, () => {
            $('html, body').animate({
                scrollTop: $('#generatedTeamsArea').offset().top - 80
            }, 300);
        });
    }
    
    copyTeamSheetToClipboard() {
        if (!this.currentWhiteTeam.length || !this.currentColourTeam.length) return;
        
        let teamSheetText = `⚽ *Sidewinders Match Squad Selection* ⚽\n\n`;
        teamSheetText += `⚪ *WHITE TEAM* ⚪\n`;
        this.currentWhiteTeam.forEach((p, index) => { teamSheetText += `${index + 1}. ${p.name}\n`; });
        
        teamSheetText += `\n🟡 *COLOUR TEAM* 🟡\n`;
        this.currentColourTeam.forEach((p, index) => { teamSheetText += `${index + 1}. ${p.name}\n`; });
        
        teamSheetText += `\n📊 Balanced via Sidewinders Football Analytics Platform`;
        
        navigator.clipboard.writeText(teamSheetText)
            .then(() => {
                const toast = `<div class="toast show position-fixed bottom-0 end-0 m-3" role="alert" style="z-index: 2000;">
                    <div class="toast-header bg-success text-white">
                        <strong class="me-auto">Success!</strong>
                        <button type="button" class="btn-close btn-close-white" onclick="this.parentElement.parentElement.remove()"></button>
                    </div>
                    <div class="toast-body">Team Sheet copied to clipboard in WhatsApp format!</div>
                </div>`;
                $('body').append(toast);
                setTimeout(() => $('.toast').fadeOut(400, function() { $(this).remove(); }), 3000);
            })
            .catch(err => { alert('Could not copy to clipboard automatically.'); });
    }

    selectPlayerFromTable(playerName) {
        const select = document.getElementById('playerSelect');
        if (!select) return;
        select.value = playerName;
        this.renderPlayerAnalysis(playerName);
        
        $('html, body').animate({
            scrollTop: $('#analysis').offset().top - 20
        }, 500);
    }
    
    renderPlayerAnalysis(playerName) {
        const contentDiv = document.getElementById('analysisContent');
        const placeholderDiv = document.getElementById('analysisPlaceholder');
        if (!contentDiv || !placeholderDiv) return;
        
        if (!playerName || playerName === '') {
            contentDiv.classList.add('d-none');
            placeholderDiv.classList.remove('d-none');
            this.selectedPlayer = null;
            return;
        }
        
        this.selectedPlayer = playerName;
        placeholderDiv.classList.add('d-none');
        contentDiv.classList.remove('d-none');
        
        const playerStats = this.leagueTable.find(p => p.Player === playerName) || {
            Player: playerName, Played: 0, Wins: 0, Draws: 0, Losses: 0, Goals: 0, Assists: 0, PPG: 0, WinPercent: 0
        };
        
        document.getElementById('anaPlayerName').innerText = playerStats.Player;
        document.getElementById('anaPlayerPPG').innerText = `${playerStats.PPG.toFixed(2)} PPG`;
        document.getElementById('anaMatches').innerText = playerStats.Played;
        document.getElementById('anaWinPercent').innerText = `${playerStats.WinPercent.toFixed(1)}%`;
        document.getElementById('anaGoals').innerText = playerStats.Goals;
        document.getElementById('anaAssists').innerText = playerStats.Assists;
        
        const historyContainer = document.getElementById('anaHistoryLog');
        historyContainer.innerHTML = '';
        
        const personalMatches = this.gameLog.filter(row => row['Player'] === playerName);
        
        if (personalMatches.length === 0) {
            historyContainer.innerHTML = '<div class="p-3 text-muted text-center small">No match records logged.</div>';
            return;
        }
        
        personalMatches.slice().reverse().forEach(row => {
            const div = document.createElement('div');
            div.className = 'list-group-item d-flex justify-content-between align-items-center py-2';
            
            const team = row['Team'] ? row['Team'] : 'White';
            const badgeClass = team.toLowerCase() === 'white' ? 'bg-light text-dark border' : 'bg-primary text-white';
            
            const result = row['Result'] ? row['Result'].toUpperCase() : 'UNKNOWN';
            let resultBadgeClass = 'bg-secondary';
            if (result === 'WIN') resultBadgeClass = 'bg-success';
            if (result === 'LOSS') resultBadgeClass = 'bg-danger';
            
            div.innerHTML = `
                <div>
                    <span class="badge ${badgeClass} me-2">${team}</span>
                    <span class="text-muted small">${row['Date']} (Match #${row['ID']})</span>
                </div>
                <div class="text-end">
                    <span class="badge ${resultBadgeClass} me-2">${result}</span>
                    <span class="badge bg-light text-dark border small me-1">G: ${row['Gls'] || 0}</span>
                    <span class="badge bg-light text-dark border small">A: ${row['Ast'] || 0}</span>
                </div>
            `;
            historyContainer.appendChild(div);
        });
    }
    
    updateLastUpdated() {
        if (this.gameLog.length > 0 && document.getElementById('lastUpdated')) {
            const lastRecord = this.gameLog[this.gameLog.length - 1];
            document.getElementById('lastUpdated').innerText = `Active Logs Tracking: ${this.gameLog.length} rows detected | Latest Match Sequence Index: #${lastRecord['ID'] || 'N/A'} (${lastRecord['Date'] || 'N/A'})`;
        }
    }
    
    async fetchCSV(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP network error code: ${response.status}`);
        return await response.text();
    }
    
    parseCSV(text) {
        const lines = text.split(/\r?\n/);
        const result = [];
        if (lines.length === 0 || !lines[0]) return result;
        
        // Clean up byte order marks and white space from columns
        const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''));
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const currentline = lines[i].split(',');
            const row = {};
            
            headers.forEach((header, index) => {
                // FORCE COMPLETE TRIM REMOVAL OF LEADING/TRAILING BLANK SPACES FROM CSV VALUES
                row[header] = currentline[index] ? currentline[index].trim() : '';
            });
            result.push(row);
        }
        return result;
    }
    
    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            if (show) spinner.classList.remove('d-none');
            else spinner.classList.add('d-none');
        }
    }
    
    showError(message) {
        const container = document.getElementById('errorContainer');
        if (container) {
            container.innerText = message;
            container.classList.remove('d-none');
        }
    }
}

// Global anchor scroll transitions configuration
$(document).ready(function() {
    $('a[href="#league"]').click(function(e) {
        e.preventDefault();
        $('html, body').animate({ scrollTop: $('#league').offset().top - 20 }, 500);
    });
    
    $('a[href="#teamGenerator"]').click(function(e) {
        e.preventDefault();
        $('html, body').animate({ scrollTop: $('#teamGenerator').offset().top - 20 }, 500);
    });
    
    $('a[href="#analysis"]').click(function(e) {
        e.preventDefault();
        $('html, body').animate({ scrollTop: $('#analysis').offset().top - 20 }, 500);
    });
});

function shareCurrentPlayer() {
    const playerSelect = document.getElementById('playerSelect');
    if (!playerSelect || !playerSelect.value) {
        alert('Please select a player first.');
        return;
    }
    const playerName = playerSelect.value;
    const url = new URL(window.location.href);
    url.hash = `player-${encodeURIComponent(playerName)}`;
    
    navigator.clipboard.writeText(url.toString())
        .then(() => {
            const toast = `<div class="toast show position-fixed bottom-0 end-0 m-3" role="alert" style="z-index: 2000;">
                <div class="toast-header bg-success text-white">
                    <strong class="me-auto">Success!</strong>
                    <button type="button" class="btn-close btn-close-white" onclick="this.parentElement.parentElement.remove()"></button>
                </div>
                <div class="toast-body">Link to ${playerName}'s analysis copied to clipboard!</div>
            </div>`;
            $('body').append(toast);
            setTimeout(() => $('.toast').fadeOut(400, function() { $(this).remove(); }), 3000);
        })
        .catch(err => { alert('Failed to copy link references automatically.'); });
}

window.sidewindersApp = new SidewindersStats();
