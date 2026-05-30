// Sidewinders Stats - Multi-Season Hub v6.0 (Extended Stats toggle)
class SidewindersStats {
    constructor() {
        this.gameLog = [];
        this.leagueTable = [];
        this.players = [];
        this.selectedPlayer = null;
        this.MIN_GAMES_THRESHOLD = 5;
        this.currentSeason = null;
        this.dataTable = null;
        this.extendedColumnsIndices = [10, 11, 12, 13]; // GPG, APG, PPG, Win%
        
        // Season definitions
        this.seasons = {
            current: { name: "2025-2026", type: "full", file: "GameLog.csv", hasAnalysis: true, label: "2025-2026" },
            archive2526: { name: "2025-2026 (Archived)", type: "full", file: "GameLog25.csv", hasAnalysis: true, label: "2025-2026 (Archived)" },
            summer25: { name: "Summer 2025", type: "summary", file: "Summer25.csv", hasAnalysis: false, label: "Summer 2025" },
            season2425: { name: "2024-2025", type: "summary", file: "Season24.csv", hasAnalysis: false, label: "2024-2025" },
            season2324: { name: "2023-2024", type: "summary", file: "Season23.csv", hasAnalysis: false, label: "2023-2024" }
        };
        
        $(document).ready(() => {
            window.sidewindersApp = this;
            this.init();
        });
    }
    
    async init() {
        try {
            this.showLoading(true);
            await this.loadSeason("current");
            this.setupEventListeners();
            this.setupExtendedStatsToggle();
            this.showLoading(false);
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to load data. Check CSV files.');
            this.showLoading(false);
        }
    }
    
    setupEventListeners() {
        // Season selector
        $('#seasonList .dropdown-item').on('click', (e) => {
            const seasonId = $(e.currentTarget).data('season');
            if (seasonId && this.seasons[seasonId]) {
                this.loadSeason(seasonId);
            }
        });
        
        // Min games filter
        $('#filterMinGames').off('change').on('change', () => {
            this.refreshLeagueTable();
        });
        
        // Recalc button (only for full seasons)
        $('#recalcBtn').off('click').on('click', () => {
            if (this.currentSeason && this.seasons[this.currentSeason].type === 'full') {
                this.calculateLeagueTable();
                this.refreshLeagueTable();
            } else {
                this.refreshLeagueTable(); // just re-apply filter
            }
        });
        
        // Reset sort button
        $('#resetSortBtn').off('click').on('click', () => {
            this.resetSorting();
        });
        
        // Share button
        $('#shareButton').off('click').on('click', () => {
            this.shareCurrentPlayer();
        });
    }
    
    setupExtendedStatsToggle() {
        const toggle = $('#extendedStatsToggle');
        // Set default based on screen width
        const isDesktop = window.innerWidth >= 768;
        const savedPref = localStorage.getItem('sidewinders_extended_stats');
        let defaultState;
        if (savedPref !== null) {
            defaultState = savedPref === 'true';
        } else {
            defaultState = isDesktop;
        }
        toggle.prop('checked', defaultState);
        this.setExtendedStatsVisibility(defaultState);
        
        toggle.on('change', () => {
            const isChecked = toggle.is(':checked');
            localStorage.setItem('sidewinders_extended_stats', isChecked);
            this.setExtendedStatsVisibility(isChecked);
        });
    }
    
    setExtendedStatsVisibility(show) {
        if (this.dataTable) {
            for (let col of this.extendedColumnsIndices) {
                this.dataTable.column(col).visible(show);
            }
        }
    }
    
    async loadSeason(seasonId) {
        this.currentSeason = seasonId;
        const season = this.seasons[seasonId];
        $('#currentSeasonLabel').text(season.label);
        
        this.showLoading(true);
        
        try {
            if (season.type === 'full') {
                await this.loadFullSeason(season.file);
                this.calculateLeagueTable();
                this.initPlayerSelector();
                $('#playerStats').hide();
                $('#shareButton').prop('disabled', true);
                $('#analysis').show();
                $('#analysisNavLink').show();
            } else {
                await this.loadSummarySeason(season.file);
                $('#playerStats').hide();
                $('#shareButton').prop('disabled', true);
                $('#analysis').hide();
                $('#analysisNavLink').hide();
            }
            this.initLeagueTable(); // creates DataTable
            this.updateLastUpdated(season.file);
            this.showLoading(false);
        } catch (err) {
            console.error(`Failed to load season ${seasonId}:`, err);
            this.showError(`Could not load data for ${season.name}. Check file: ${season.file}`);
            this.showLoading(false);
        }
    }
    
    async loadFullSeason(filename) {
        const csvText = await this.fetchCSV(filename);
        this.gameLog = this.parseCSV(csvText);
        this.players = [...new Set(this.gameLog.map(row => row['Player']))]
            .filter(name => name && name.trim() !== '')
            .sort();
        console.log(`Loaded ${this.gameLog.length} game records for ${this.players.length} players.`);
    }
    
    async loadSummarySeason(filename) {
        const csvText = await this.fetchCSV(filename);
        this.leagueTable = this.parseSummaryCSV(csvText);
        this.players = this.leagueTable.map(p => p.Player).sort();
        this.gameLog = [];
    }
    
    async fetchCSV(filename) {
        const cacheBuster = `?t=${new Date().getTime()}`;
        const response = await fetch(filename + cacheBuster);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
    }
    
    parseCSV(csvText) {
        if (!csvText || csvText.trim() === '') return [];
        const cleanText = csvText.replace(/\r/g, "").trim();
        const lines = cleanText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const headers = this.parseCSVLine(lines[0]).map(h => h.replace(/^"(.*)"$/, '$1').trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === 0) continue;
            const row = {};
            headers.forEach((header, index) => {
                if (header && values[index] !== undefined) {
                    let value = values[index].replace(/^"(.*)"$/, '$1').trim();
                    const numericColumns = ['Gls', 'OG', 'Ast', 'Pen'];
                    if (numericColumns.includes(header) && !isNaN(value) && value !== '') {
                        value = Number(value);
                    }
                    row[header] = value;
                }
            });
            if (Object.keys(row).length > 0 && row[headers[0]]) {
                data.push(row);
            }
        }
        return data;
    }
    
    parseCSVLine(line) {
        const values = [];
        let currentValue = '';
        let insideQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            if (char === '"') {
                if (insideQuotes && nextChar === '"') { currentValue += '"'; i++; }
                else { insideQuotes = !insideQuotes; }
            } else if (char === ',' && !insideQuotes) {
                values.push(currentValue);
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue);
        return values;
    }
    
    parseSummaryCSV(csvText) {
        const lines = csvText.trim().split(/\r?\n/);
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length < 5) continue;
            const player = values[0];
            if (!player || player === '') continue;
            const games = parseInt(values[headers.indexOf('P')]) || 0;
            if (games === 0) continue;
            const wins = parseInt(values[headers.indexOf('W')]) || 0;
            const draws = parseInt(values[headers.indexOf('D')]) || 0;
            const losses = parseInt(values[headers.indexOf('L')]) || 0;
            const goals = parseInt(values[headers.indexOf('Gls')] || 0) || 0;
            const ownGoals = parseInt(values[headers.indexOf('OG')] || 0) || 0;
            const assists = parseInt(values[headers.indexOf('Ast')] || 0) || 0;
            let points = parseInt(values[headers.indexOf('Pts')] || 0) || 0;
            if (points === 0 && (wins > 0 || draws > 0)) points = wins * 3 + draws;
            const ppg = games > 0 ? Math.round((points / games) * 100) / 100 : 0;
            const winPercent = games > 0 ? Math.round((wins / games) * 1000) / 10 : 0;
            const gpg = games > 0 ? Math.round((goals / games) * 100) / 100 : 0;
            const apg = games > 0 ? Math.round((assists / games) * 100) / 100 : 0;
            data.push({
                Player: player,
                Games: games,
                Wins: wins,
                Draws: draws,
                Losses: losses,
                Goals: goals,
                OwnGoals: ownGoals,
                Assists: assists,
                Penalties: 0,
                TotalPoints: points,
                GPG: gpg,
                APG: apg,
                PPG: ppg,
                WinPercent: winPercent
            });
        }
        return data;
    }
    
    calculateLeagueTable() {
        const playerStats = {};
        this.players.forEach(player => {
            playerStats[player] = {
                Player: player, Games: 0, Wins: 0, Draws: 0, Losses: 0,
                Goals: 0, OwnGoals: 0, Assists: 0, Penalties: 0, TotalPoints: 0,
                GPG: 0, APG: 0, PPG: 0, WinPercent: 0
            };
        });
        
        this.gameLog.forEach(game => {
            const player = game['Player'];
            if (!player || !playerStats[player]) return;
            const stats = playerStats[player];
            stats.Games++;
            const result = game['Result'] ? game['Result'].trim() : '';
            if (result === 'Win') { stats.Wins++; stats.TotalPoints += 3; }
            else if (result === 'Draw') { stats.Draws++; stats.TotalPoints += 1; }
            else if (result === 'Loss') { stats.Losses++; }
            
            stats.Goals += parseInt(game['Gls']) || 0;
            stats.OwnGoals += parseInt(game['OG']) || 0;
            stats.Assists += parseInt(game['Ast']) || 0;
            stats.Penalties += parseInt(game['Pen']) || 0;
        });
        
        Object.values(playerStats).forEach(stats => {
            if (stats.Games > 0) {
                stats.GPG = Math.round((stats.Goals / stats.Games) * 100) / 100;
                stats.APG = Math.round((stats.Assists / stats.Games) * 100) / 100;
                stats.PPG = Math.round((stats.TotalPoints / stats.Games) * 100) / 100;
                stats.WinPercent = Math.round((stats.Wins / stats.Games) * 1000) / 10;
            }
        });
        this.leagueTable = Object.values(playerStats);
    }
    
    initLeagueTable() {
        if (this.dataTable) {
            this.dataTable.destroy();
            this.dataTable = null;
        }
        
        const shouldFilter = $('#filterMinGames').is(':checked');
        const runningDataset = shouldFilter 
            ? this.leagueTable.filter(p => Number(p.Games) >= this.MIN_GAMES_THRESHOLD)
            : [...this.leagueTable];
        
        // Filter status indicator
        const filterStatus = $('#filterStatus');
        if (shouldFilter) {
            const totalPlayers = this.leagueTable.length;
            const shownPlayers = runningDataset.length;
            if (!filterStatus.length) {
                $('.d-flex.justify-content-between.align-items-center.mb-3').find('.d-flex.gap-3').after(
                    `<span id="filterStatus" class="badge bg-info ms-2">Filter: ${shownPlayers}/${totalPlayers} (min ${this.MIN_GAMES_THRESHOLD})</span>`
                );
            } else {
                filterStatus.text(`Filter: ${shownPlayers}/${totalPlayers} (min ${this.MIN_GAMES_THRESHOLD})`);
            }
        } else {
            $('#filterStatus').remove();
        }
        
        const columns = [
            { data: 'Player', className: 'fw-bold clickable-player', render: data => `<span class="clickable-player">${data}</span>` },
            { data: 'Games', className: 'text-center' },
            { data: 'Wins', className: 'text-center' },
            { data: 'Draws', className: 'text-center' },
            { data: 'Losses', className: 'text-center' },
            { data: 'Goals', className: 'text-center fw-bold text-primary', render: data => `<span class="goals-highlight">${data}</span>` },
            { data: 'OwnGoals', className: 'text-center' },
            { data: 'Assists', className: 'text-center' },
            { data: 'Penalties', className: 'text-center' },
            { data: 'TotalPoints', className: 'text-center fw-bold text-success', render: data => `<strong class="points-badge">${data}</strong>` },
            { data: 'GPG', className: 'text-center', render: data => `<span class="gpg-value">${data.toFixed(2)}</span>` },
            { data: 'APG', className: 'text-center', render: data => `<span class="apg-value">${data.toFixed(2)}</span>` },
            { data: 'PPG', className: 'text-center', render: data => `<span class="ppg-value">${data.toFixed(2)}</span>` },
            { data: 'WinPercent', className: 'text-center', render: data => {
                let color = '#dc3545';
                if (data >= 60) color = '#198754';
                else if (data >= 40) color = '#fd7e14';
                return `<span style="color: ${color}; font-weight: bold">${data}%</span>`;
            }}
        ];
        
        this.dataTable = $('#leagueTable').DataTable({
            data: runningDataset,
            columns: columns,
            order: [[9, 'desc']],
            pageLength: 25,
            responsive: true,
            stateSave: false,
            destroy: true
        });
        
        // Set visibility based on current toggle state
        const extendedOn = $('#extendedStatsToggle').is(':checked');
        this.setExtendedStatsVisibility(extendedOn);
        
        // Player click only if full season
        if (this.seasons[this.currentSeason].hasAnalysis) {
            $('#leagueTable tbody').off('click', 'span.clickable-player').on('click', 'span.clickable-player', (event) => {
                const playerName = $(event.target).text().trim();
                if (playerName && this.players.includes(playerName)) {
                    this.selectPlayer(playerName);
                    $('html, body').animate({ scrollTop: $('#analysis').offset().top - 20 }, 500);
                }
            });
        } else {
            $('#leagueTable tbody').off('click', 'span.clickable-player');
        }
        
        this.addQuickSortButtons();
    }
    
    refreshLeagueTable() {
        if (this.dataTable) {
            const shouldFilter = $('#filterMinGames').is(':checked');
            const newData = shouldFilter 
                ? this.leagueTable.filter(p => Number(p.Games) >= this.MIN_GAMES_THRESHOLD)
                : [...this.leagueTable];
            this.dataTable.clear();
            this.dataTable.rows.add(newData);
            this.dataTable.draw();
            // Update filter status display
            const totalPlayers = this.leagueTable.length;
            const shownPlayers = newData.length;
            let filterSpan = $('#filterStatus');
            if (shouldFilter) {
                if (filterSpan.length === 0) {
                    $('.d-flex.justify-content-between.align-items-center.mb-3').find('.d-flex.gap-3').after(
                        `<span id="filterStatus" class="badge bg-info ms-2">Filter: ${shownPlayers}/${totalPlayers} (min ${this.MIN_GAMES_THRESHOLD})</span>`
                    );
                } else {
                    filterSpan.text(`Filter: ${shownPlayers}/${totalPlayers} (min ${this.MIN_GAMES_THRESHOLD})`);
                }
            } else {
                filterSpan.remove();
            }
        } else {
            this.initLeagueTable();
        }
    }
    
    addQuickSortButtons() {
        $('#quickSortButtons').remove();
        const quickSortHtml = `
            <div id="quickSortButtons" class="mb-3">
                <div class="btn-group" role="group">
                    <button class="btn btn-outline-primary btn-sm sort-btn active" data-sort="9" data-order="desc"><i class="fas fa-trophy me-1"></i> Points</button>
                    <button class="btn btn-outline-primary btn-sm sort-btn" data-sort="10" data-order="desc"><i class="fas fa-futbol me-1"></i> GPG</button>
                    <button class="btn btn-outline-primary btn-sm sort-btn" data-sort="11" data-order="desc"><i class="fas fa-handshake me-1"></i> APG</button>
                    <button class="btn btn-outline-primary btn-sm sort-btn" data-sort="12" data-order="desc"><i class="fas fa-chart-line me-1"></i> PPG</button>
                    <button class="btn btn-outline-primary btn-sm sort-btn" data-sort="13" data-order="desc"><i class="fas fa-percentage me-1"></i> Win %</button>
                </div>
            </div>`;
        $('#leagueTable_wrapper').prepend(quickSortHtml);
        $('.sort-btn').off('click').on('click', (e) => {
            const button = $(e.currentTarget);
            const columnIndex = parseInt(button.data('sort'));
            const order = button.data('order');
            if (this.dataTable) {
                $('.sort-btn').removeClass('active');
                button.addClass('active');
                this.dataTable.order([columnIndex, order]).draw();
            }
        });
    }
    
    resetSorting() {
        if (this.dataTable) {
            this.dataTable.order([[9, 'desc']]).draw();
            $('.sort-btn').removeClass('active');
            $('.sort-btn[data-sort="9"]').addClass('active');
        }
    }
    
    initPlayerSelector() {
        const select = $('#playerSelect');
        select.empty().append('<option value="">Choose a player...</option>');
        this.players.forEach(player => select.append(`<option value="${player}">${player}</option>`));
        select.off('change').on('change', (e) => {
            if (e.target.value) this.selectPlayer(e.target.value);
        });
    }
    
    selectPlayer(playerName) {
        if (!this.seasons[this.currentSeason].hasAnalysis) return;
        this.selectedPlayer = playerName;
        $('#playerSelect').val(playerName);
        this.showPlayerAnalysis(playerName);
        const url = new URL(window.location.href);
        url.hash = `player-${encodeURIComponent(playerName)}`;
        history.replaceState(null, '', url);
    }
    
    showPlayerAnalysis(playerName) {
        $('#playerName').text(playerName);
        const playerStats = this.leagueTable.find(row => row.Player === playerName);
        if (playerStats) {
            $('#totalGames').text(playerStats.Games);
            $('#totalWins').text(playerStats.Wins);
            $('#totalDraws').text(playerStats.Draws);
            $('#totalLosses').text(playerStats.Losses);
            $('#totalPoints').text(playerStats.TotalPoints);
            $('#totalGoals').text(playerStats.Goals);
            $('#totalAssists').text(playerStats.Assists);
            $('#totalOwnGoals').text(playerStats.OwnGoals);
            $('#goalContributions').text(playerStats.Goals + playerStats.Assists);
            $('#winPercent').text(playerStats.WinPercent + '%');
            $('#winPercentBar').css('width', playerStats.WinPercent + '%');
            this.renderFormBadges(playerName);
        }
        $('#playerStats').show();
        $('#shareButton').prop('disabled', false);
        this.calculateAndRenderPartnerships(playerName);
    }
    
    renderFormBadges(playerName) {
        const playerMatches = this.gameLog.filter(game => game['Player'] === playerName);
        playerMatches.sort((a, b) => (parseInt(b['ID']) || 0) - (parseInt(a['ID']) || 0));
        const lastFive = playerMatches.slice(0, 5);
        const container = $('#playerFormBadges').empty();
        if (lastFive.length === 0) { container.text('-'); return; }
        lastFive.forEach(match => {
            const res = match['Result'] ? match['Result'].trim() : '';
            let badgeColor = 'bg-secondary';
            if (res === 'Win') badgeColor = 'bg-success';
            if (res === 'Draw') badgeColor = 'bg-warning';
            if (res === 'Loss') badgeColor = 'bg-danger';
            container.append(`<span class="form-badge ${badgeColor}" title="Match ${match['ID']} | ${match['Date'] || ''}">${res[0] || '?'}</span>`);
        });
    }
    
    calculateAndRenderPartnerships(selectedPlayer) {
        const analysisData = [];
        this.players.forEach(otherPlayer => {
            if (otherPlayer === selectedPlayer) return;
            const selectedGames = this.gameLog.filter(game => game['Player'] === selectedPlayer);
            const otherGames = this.gameLog.filter(game => game['Player'] === otherPlayer);
            let gamesInCommon = 0, sameTeamGames = 0, winTogether = 0, oppositeTeamGames = 0, selectedWinsVsOther = 0;
            const selectedGameMap = {};
            selectedGames.forEach(g => { const teamName = g['Team'] ? g['Team'].trim() : ''; selectedGameMap[`${g['ID']}|${teamName}`] = g; });
            const otherGameMap = {};
            otherGames.forEach(g => { const teamName = g['Team'] ? g['Team'].trim() : ''; otherGameMap[`${g['ID']}|${teamName}`] = g; });
            
            Object.keys(selectedGameMap).forEach(key => {
                if (otherGameMap[key]) { gamesInCommon++; sameTeamGames++; if (selectedGameMap[key]['Result'] && selectedGameMap[key]['Result'].trim() === 'Win') winTogether++; }
            });
            selectedGames.forEach(sGame => {
                otherGames.forEach(oGame => {
                    const sTeam = sGame['Team'] ? sGame['Team'].trim() : 'White';
                    const oTeam = oGame['Team'] ? oGame['Team'].trim() : 'Colour';
                    if (sGame['ID'] === oGame['ID'] && sTeam !== oTeam) {
                        gamesInCommon++; oppositeTeamGames++;
                        if (sGame['Result'] && sGame['Result'].trim() === 'Win') selectedWinsVsOther++;
                    }
                });
            });
            if (gamesInCommon > 0) {
                analysisData.push({
                    player: otherPlayer,
                    gamesInCommon: gamesInCommon,
                    sameTeam: sameTeamGames,
                    oppositeTeam: oppositeTeamGames,
                    winPercentTogether: sameTeamGames > 0 ? Math.round((winTogether / sameTeamGames) * 100) : 0,
                    h2hWinPercent: oppositeTeamGames > 0 ? Math.round((selectedWinsVsOther / oppositeTeamGames) * 100) : 0
                });
            }
        });
        this.initPartnershipDataTable(analysisData);
    }
    
    initPartnershipDataTable(data) {
        if ($.fn.DataTable.isDataTable('#partnershipTable')) {
            $('#partnershipTable').DataTable().destroy();
        }
        $('#partnershipTable').DataTable({
            data: data,
            columns: [
                { data: 'player', className: 'fw-bold clickable-player', render: d => `<span class="clickable-player">${d}</span>` },
                { data: 'gamesInCommon', className: 'text-center' },
                { data: 'sameTeam', className: 'text-center' },
                { data: 'oppositeTeam', className: 'text-center', render: d => d > 0 ? d : '-' },
                { data: 'winPercentTogether', className: 'text-center', render: (d, t, row) => row.sameTeam > 0 ? `${d}%` : '-' },
                { data: 'h2hWinPercent', className: 'text-center', render: (d, t, row) => row.oppositeTeam > 0 ? `${d}%` : '-' }
            ],
            paging: false, searching: false, info: false, ordering: true, order: [[1, 'desc']], responsive: true,
            createdRow: function(row, rowData) {
                if (rowData.sameTeam > 0 && rowData.winPercentTogether >= 60) $(row).find('td:eq(4)').addClass('table-success-light');
                if (rowData.sameTeam > 0 && rowData.winPercentTogether <= 30) $(row).find('td:eq(4)').addClass('table-danger-light');
                if (rowData.oppositeTeam > 0 && rowData.h2hWinPercent >= 60) $(row).find('td:eq(5)').addClass('table-success-light');
                if (rowData.oppositeTeam > 0 && rowData.h2hWinPercent <= 30) $(row).find('td:eq(5)').addClass('table-danger-light');
            }
        });
        $('#partnershipTable tbody').off('click', 'span.clickable-player').on('click', 'span.clickable-player', (event) => {
            const playerName = $(event.target).text().trim();
            if (playerName && this.players.includes(playerName)) this.selectPlayer(playerName);
        });
    }
    
    async updateLastUpdated(filename) {
        try {
            const res = await fetch(filename, { method: 'HEAD', cache: 'no-store' });
            const lastModified = res.headers.get('last-modified');
            $('#lastUpdated').text(lastModified ? new Date(lastModified).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'));
        } catch {
            $('#lastUpdated').text(new Date().toLocaleDateString('en-GB'));
        }
    }
    
    shareCurrentPlayer() {
        const playerName = $('#playerSelect').val();
        if (!playerName) return;
        const url = new URL(window.location.href);
        url.hash = `player-${encodeURIComponent(playerName)}`;
        navigator.clipboard.writeText(url.toString()).then(() => {
            alert(`Link to ${playerName}'s stats copied!`);
        });
    }
    
    showLoading(show) { $('#loadingIndicator').toggle(show); }
    showError(msg) { $('.container').prepend(`<div class="alert alert-danger alert-dismissible fade show" role="alert"><strong>Error:</strong> ${msg}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`); }
}

// Start the app
new SidewindersStats();
