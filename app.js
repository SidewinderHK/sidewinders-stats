// Sidewinders Stats Hub - Multi-Season v6.3
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
        
        this.seasons = {
            current: { 
                name: "Current Season", 
                file: "GameLog.csv", 
                label: "Current Season",
                heading: "Current Season"
            },
            summer26: { 
                name: "Summer 2026", 
                file: "Summer26.csv", 
                label: "Summer 2026",
                heading: "Summer 2026"
            },
            archive2526: { 
                name: "2025/26 Season", 
                file: "GameLog25.csv", 
                label: "2025/26 Season",
                heading: "2025/26 Season"
            },
            summer25: { 
                name: "Summer 2025", 
                file: "Summer25.csv", 
                label: "Summer 2025",
                heading: "Summer 2025"
            },
            season2425: { 
                name: "2024/25 Season", 
                file: "Season24.csv", 
                label: "2024/25 Season",
                heading: "2024/25 Season"
            },
            season2324: { 
                name: "2023/24 Season", 
                file: "Season23.csv", 
                label: "2023/24 Season",
                heading: "2023/24 Season"
            }
        };
        
        $(document).ready(() => {
            window.sidewindersApp = this;
            this.init();
        });
    }
    
    async init() {
        try {
            this.showLoading(true);
            this.setupEventListeners();
            this.setupExtendedStatsToggle();
            await this.loadSeason("current");
            this.showLoading(false);
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize application. Please check data files.');
            this.showLoading(false);
        }
    }
    
    setupEventListeners() {
        $(document).off('click', '#seasonList .dropdown-item').on('click', '#seasonList .dropdown-item', (e) => {
            e.preventDefault();
            const target = $(e.currentTarget);
            const seasonId = target.attr('data-season') || target.data('season');
            if (seasonId) {
                this.loadSeason(seasonId);
            }
        });
        
        $('#filterMinGames').off('change').on('change', () => {
            this.refreshLeagueTable();
        });
        
        $('#recalcBtn').off('click').on('click', () => {
            if (this.gameLog && this.gameLog.length > 0) {
                this.calculateLeagueTable();
            }
            this.refreshLeagueTable();
        });
        
        $('#resetSortBtn').off('click').on('click', () => {
            this.resetSorting();
        });
        
        $('#shareButton').off('click').on('click', () => {
            this.shareCurrentPlayer();
        });
    }
    
    setupExtendedStatsToggle() {
        const toggle = $('#extendedStatsToggle');
        const isDesktop = window.innerWidth >= 768;
        const savedPref = localStorage.getItem('sidewinders_extended_stats');
        let defaultState = (savedPref !== null) ? (savedPref === 'true') : isDesktop;
        
        toggle.prop('checked', defaultState);
        
        toggle.off('change').on('change', () => {
            const isChecked = toggle.is(':checked');
            localStorage.setItem('sidewinders_extended_stats', isChecked);
            this.setExtendedStatsVisibility(isChecked);
        });
    }
    
    setExtendedStatsVisibility(show) {
        if (this.dataTable) {
            for (let col of this.extendedColumnsIndices) {
                this.dataTable.column(col).visible(show, false);
            }
            this.dataTable.columns.adjust().draw(false);
        }
    }

    getSeasonKey(key) {
        if (!key) return null;
        const lowerKey = key.toString().toLowerCase();
        return Object.keys(this.seasons).find(k => k.toLowerCase() === lowerKey) || null;
    }
    
    async loadSeason(seasonId) {
        const actualKey = this.getSeasonKey(seasonId);
        if (!actualKey) {
            console.error(`Season key '${seasonId}' not found.`);
            return;
        }
        
        this.currentSeason = actualKey;
        const season = this.seasons[actualKey];
        
        $('#currentSeasonLabel').text(season.label);
        $('#seasonHeading').text(season.heading);
        
        $('#seasonList .dropdown-item').removeClass('active');
        $(`#seasonList .dropdown-item[data-season="${actualKey}"]`).addClass('active');
        
        this.showLoading(true);
        $('#alertArea').empty();
        
        try {
            const csvText = await this.fetchCSV(season.file);
            const isFullLog = this.detectCSVType(csvText);
            
            if (isFullLog) {
                this.gameLog = this.parseCSV(csvText);
                this.calculateLeagueTable();
                this.players = [...new Set(this.gameLog.map(row => {
                    const pKey = Object.keys(row).find(k => k.toLowerCase() === 'player');
                    return pKey ? row[pKey] : null;
                }))].filter(name => name && name.trim() !== '').sort();
                
                this.initPlayerSelector();
                $('#playerStats').hide();
                $('#shareButton').prop('disabled', true);
                $('#analysis').show();
                $('#analysisNavLink').show();
            } else {
                this.gameLog = [];
                this.leagueTable = this.parseSummaryCSV(csvText);
                this.players = this.leagueTable.map(p => p.Player).sort();
                
                $('#playerStats').hide();
                $('#shareButton').prop('disabled', true);
                $('#analysis').hide();
                $('#analysisNavLink').hide();
            }
            
            this.initLeagueTable();
            this.updateLastUpdated(season.file);
            this.showLoading(false);
        } catch (err) {
            console.error(`Failed to load season ${actualKey}:`, err);
            this.showError(`Could not load stats for ${season.name} (${season.file}). Ensure the file exists in the directory.`);
            this.showLoading(false);
        }
    }
    
    detectCSVType(csvText) {
        if (!csvText || csvText.trim() === '') return false;
        const firstLine = csvText.trim().split('\n')[0].toLowerCase();
        return firstLine.includes('result') || (firstLine.includes('player') && firstLine.includes('team'));
    }

    async fetchCSV(filename) {
        const cacheBuster = `?t=${new Date().getTime()}`;
        const response = await fetch(filename + cacheBuster);
        if (!response.ok) throw new Error(`HTTP ${response.status} loading ${filename}`);
        return await response.text();
    }
    
    detectDelimiter(line) {
        if (line.includes(';')) return ';';
        if (line.includes('\t')) return '\t';
        return ',';
    }

    parseCSVLine(line, delimiter = ',') {
        const values = [];
        let currentValue = '';
        let insideQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            if (char === '"') {
                if (insideQuotes && nextChar === '"') { currentValue += '"'; i++; }
                else { insideQuotes = !insideQuotes; }
            } else if (char === delimiter && !insideQuotes) {
                values.push(currentValue);
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue);
        return values;
    }

    parseCSV(csvText) {
        if (!csvText || csvText.trim() === '') return [];
        const cleanText = csvText.replace(/\r/g, "").trim();
        const lines = cleanText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const delimiter = this.detectDelimiter(lines[0]);
        const headers = this.parseCSVLine(lines[0], delimiter).map(h => h.replace(/^"(.*)"$/, '$1').trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i], delimiter);
            if (values.length === 0) continue;
            const row = {};
            headers.forEach((header, index) => {
                if (header && values[index] !== undefined) {
                    let value = values[index].replace(/^"(.*)"$/, '$1').trim();
                    const numericColumns = ['gls', 'og', 'ast', 'pen', 'goals', 'assists', 'owngoals'];
                    if (numericColumns.includes(header.toLowerCase()) && !isNaN(value) && value !== '') {
                        value = Number(value);
                    }
                    row[header] = value;
                }
            });
            const playerVal = row['Player'] || row['player'];
            if (Object.keys(row).length > 0 && playerVal) {
                data.push(row);
            }
        }
        return data;
    }
    
    findColIndex(headers, possibleNames) {
        if (!headers || !Array.isArray(headers)) return -1;
        const cleanHeaders = headers.map(h => h ? h.replace(/^"(.*)"$/, '$1').trim().toLowerCase() : '');
        for (let name of possibleNames) {
            const idx = cleanHeaders.indexOf(name.toLowerCase());
            if (idx !== -1) return idx;
        }
        return -1;
    }
    
    parseSummaryCSV(csvText) {
        if (!csvText || csvText.trim() === '') return [];
        const cleanText = csvText.replace(/\r/g, "").trim();
        const lines = cleanText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const delimiter = this.detectDelimiter(lines[0]);
        const headers = this.parseCSVLine(lines[0], delimiter).map(h => h.replace(/^"(.*)"$/, '$1').trim());
        
        const pIdx = this.findColIndex(headers, ['Player', 'Name', 'Player Name']);
        const gIdx = this.findColIndex(headers, ['P', 'Games', 'Played', 'GP', 'MP', 'Matches']);
        const wIdx = this.findColIndex(headers, ['W', 'Wins', 'Win']);
        const dIdx = this.findColIndex(headers, ['D', 'Draws', 'Draw']);
        const lIdx = this.findColIndex(headers, ['L', 'Losses', 'Loss']);
        const glsIdx = this.findColIndex(headers, ['Gls', 'Goals', 'G', 'Goal']);
        const ogIdx = this.findColIndex(headers, ['OG', 'Own Goals', 'OwnGoals', 'Own Goal']);
        const astIdx = this.findColIndex(headers, ['Ast', 'Assists', 'A', 'Assist']);
        const ptsIdx = this.findColIndex(headers, ['Pts', 'Points', 'Total Points', 'TotalPoints', 'Point']);
        
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i], delimiter).map(v => v.replace(/^"(.*)"$/, '$1').trim());
            if (values.length === 0) continue;
            
            const player = pIdx !== -1 ? values[pIdx] : values[0];
            if (!player || player === '' || player.toLowerCase() === 'total' || player.toLowerCase() === 'totals') continue;
            
            const games = gIdx !== -1 ? (parseInt(values[gIdx]) || 0) : 0;
            const wins = wIdx !== -1 ? (parseInt(values[wIdx]) || 0) : 0;
            const draws = dIdx !== -1 ? (parseInt(values[dIdx]) || 0) : 0;
            const losses = lIdx !== -1 ? (parseInt(values[lIdx]) || 0) : 0;
            const goals = glsIdx !== -1 ? (parseInt(values[glsIdx]) || 0) : 0;
            const ownGoals = ogIdx !== -1 ? (parseInt(values[ogIdx]) || 0) : 0;
            const assists = astIdx !== -1 ? (parseInt(values[astIdx]) || 0) : 0;
            
            let points = ptsIdx !== -1 ? (parseInt(values[ptsIdx]) || 0) : 0;
            if (points === 0 && (wins > 0 || draws > 0)) {
                points = (wins * 3) + draws;
            }
            
            const totalGames = games > 0 ? games : (wins + draws + losses);
            
            const ppg = totalGames > 0 ? Math.round((points / totalGames) * 100) / 100 : 0;
            const winPercent = totalGames > 0 ? Math.round((wins / totalGames) * 1000) / 10 : 0;
            const gpg = totalGames > 0 ? Math.round((goals / totalGames) * 100) / 100 : 0;
            const apg = totalGames > 0 ? Math.round((assists / totalGames) * 100) / 100 : 0;
            
            data.push({
                Player: player,
                Games: totalGames,
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
            const playerKey = Object.keys(game).find(k => k.toLowerCase() === 'player');
            const player = playerKey ? game[playerKey] : null;
            if (!player || !playerStats[player]) return;
            
            const stats = playerStats[player];
            stats.Games++;
            
            const resKey = Object.keys(game).find(k => k.toLowerCase() === 'result');
            const result = resKey && game[resKey] ? game[resKey].trim() : '';
            if (result === 'Win' || result.toLowerCase() === 'w') { stats.Wins++; stats.TotalPoints += 3; }
            else if (result === 'Draw' || result.toLowerCase() === 'd') { stats.Draws++; stats.TotalPoints += 1; }
            else if (result === 'Loss' || result.toLowerCase() === 'l') { stats.Losses++; }
            
            const glsKey = Object.keys(game).find(k => ['gls', 'goals', 'g'].includes(k.toLowerCase()));
            const ogKey = Object.keys(game).find(k => ['og', 'owngoals', 'own goals'].includes(k.toLowerCase()));
            const astKey = Object.keys(game).find(k => ['ast', 'assists', 'a'].includes(k.toLowerCase()));
            const penKey = Object.keys(game).find(k => ['pen', 'penalties', 'pk'].includes(k.toLowerCase()));
            
            stats.Goals += (glsKey && game[glsKey]) ? (parseInt(game[glsKey]) || 0) : 0;
            stats.OwnGoals += (ogKey && game[ogKey]) ? (parseInt(game[ogKey]) || 0) : 0;
            stats.Assists += (astKey && game[astKey]) ? (parseInt(game[astKey]) || 0) : 0;
            stats.Penalties += (penKey && game[penKey]) ? (parseInt(game[penKey]) || 0) : 0;
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
        
        $('#leagueTable tbody').empty();
        
        const shouldFilter = $('#filterMinGames').is(':checked');
        const runningDataset = shouldFilter 
            ? this.leagueTable.filter(p => Number(p.Games) >= this.MIN_GAMES_THRESHOLD)
            : [...this.leagueTable];
        
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
        
        const extendedOn = $('#extendedStatsToggle').is(':checked');
        this.setExtendedStatsVisibility(extendedOn);
        
        if (this.gameLog && this.gameLog.length > 0) {
            $('#leagueTable tbody').off('click', 'span.clickable-player').on('click', 'span.clickable-player', (event) => {
                const playerName = $(event.target).text().trim();
                if (playerName && this.players.includes(playerName)) {
                    this.selectPlayer(playerName);
                    $('html, body').animate({ scrollTop: $('#analysis').offset().top - 20 }, 500);
                }
            });
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
        if (!this.gameLog || this.gameLog.length === 0) return;
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
        const playerMatches = this.gameLog.filter(game => {
            const playerKey = Object.keys(game).find(k => k.toLowerCase() === 'player');
            return playerKey && game[playerKey] === playerName;
        });
        
        playerMatches.sort((a, b) => (parseInt(b['ID']) || 0) - (parseInt(a['ID']) || 0));
        const lastFive = playerMatches.slice(0, 5);
        const container = $('#playerFormBadges').empty();
        if (lastFive.length === 0) { container.text('-'); return; }
        lastFive.forEach(match => {
            const resKey = Object.keys(match).find(k => k.toLowerCase() === 'result');
            const res = resKey && match[resKey] ? match[resKey].trim() : '';
            let badgeColor = 'bg-secondary';
            if (res === 'Win' || res.toLowerCase() === 'w') badgeColor = 'bg-success';
            if (res === 'Draw' || res.toLowerCase() === 'd') badgeColor = 'bg-warning';
            if (res === 'Loss' || res.toLowerCase() === 'l') badgeColor = 'bg-danger';
            container.append(`<span class="form-badge ${badgeColor}" title="Match ${match['ID']} | ${match['Date'] || ''}">${res[0] ? res[0].toUpperCase() : '?'}</span>`);
        });
    }
    
    calculateAndRenderPartnerships(selectedPlayer) {
        const analysisData = [];
        this.players.forEach(otherPlayer => {
            if (otherPlayer === selectedPlayer) return;
            const selectedGames = this.gameLog.filter(g => (g['Player'] || g['player']) === selectedPlayer);
            const otherGames = this.gameLog.filter(g => (g['Player'] || g['player']) === otherPlayer);
            
            let gamesInCommon = 0, sameTeamGames = 0, winTogether = 0, oppositeTeamGames = 0, selectedWinsVsOther = 0;
            const selectedGameMap = {};
            selectedGames.forEach(g => { const teamName = g['Team'] ? g['Team'].trim() : ''; selectedGameMap[`${g['ID']}|${teamName}`] = g; });
            const otherGameMap = {};
            otherGames.forEach(g => { const teamName = g['Team'] ? g['Team'].trim() : ''; otherGameMap[`${g['ID']}|${teamName}`] = g; });
            
            Object.keys(selectedGameMap).forEach(key => {
                if (otherGameMap[key]) {
                    gamesInCommon++;
                    sameTeamGames++;
                    const res = selectedGameMap[key]['Result'] ? selectedGameMap[key]['Result'].trim() : '';
                    if (res === 'Win' || res.toLowerCase() === 'w') winTogether++;
                }
            });
            
            selectedGames.forEach(sGame => {
                otherGames.forEach(oGame => {
                    const sTeam = sGame['Team'] ? sGame['Team'].trim() : 'White';
                    const oTeam = oGame['Team'] ? oGame['Team'].trim() : 'Colour';
                    if (sGame['ID'] === oGame['ID'] && sTeam !== oTeam) {
                        gamesInCommon++;
                        oppositeTeamGames++;
                        const res = sGame['Result'] ? sGame['Result'].trim() : '';
                        if (res === 'Win' || res.toLowerCase() === 'w') selectedWinsVsOther++;
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
            alert(`Link to ${playerName}'s stats copied to clipboard!`);
        });
    }
    
    showLoading(show) { $('#loadingIndicator').toggle(show); }
    showError(msg) { $('#alertArea').html(`<div class="alert alert-danger alert-dismissible fade show" role="alert"><strong>Error:</strong> ${msg}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`); }
}

new SidewindersStats();