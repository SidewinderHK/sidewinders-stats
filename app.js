// Sidewinders Stats - Multi-Season & Season View Support
class SidewindersStats {
    constructor() {
        this.gameLog = [];
        this.leagueTable = [];
        this.players = [];
        this.selectedPlayer = null;
        this.currentCsv = 'Summer26.csv'; // Default to Summer 2026
        
        $(document).ready(() => {
            this.init();
            this.bindSeasonSelector();
        });
    }

    bindSeasonSelector() {
        $('#seasonSelect').on('change', (e) => {
            this.currentCsv = e.target.value;
            this.switchSeason();
        });
    }

    async switchSeason() {
        this.showLoading(true);
        this.selectedPlayer = null;
        $('#playerStats').hide();
        await this.loadAllData();
        this.calculateLeagueTable();
        this.initLeagueTable();
        this.initPlayerSelector();
        this.updateLastUpdated();
        this.showLoading(false);
    }
    
    async init() {
        try {
            this.showLoading(true);
            await this.loadAllData();
            this.calculateLeagueTable();
            this.initLeagueTable();
            this.initPlayerSelector();
            this.updateLastUpdated();
            this.showLoading(false);
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError(`Failed to load data from ${this.currentCsv}.`);
            this.showLoading(false);
        }
    }
    
    async loadAllData() {
        try {
            const gameLogCSV = await this.fetchCSV(this.currentCsv);
            this.gameLog = this.parseCSV(gameLogCSV);
            
            this.players = [...new Set(this.gameLog.map(row => row['Player']))]
                .filter(name => name && name.trim() !== '')
                .sort();
            
            console.log(`Loaded ${this.gameLog.length} game records from ${this.currentCsv}`);
        } catch (error) {
            console.error('Error loading CSV file:', error);
            throw error;
        }
    }
    
    calculateLeagueTable() {
        const playerStats = {};
        
        this.players.forEach(player => {
            playerStats[player] = {
                Player: player,
                Games: 0, Wins: 0, Draws: 0, Losses: 0,
                Goals: 0, OwnGoals: 0, Assists: 0, Penalties: 0,
                TotalPoints: 0, PPG: 0, WinPercent: 0
            };
        });
        
        this.gameLog.forEach(game => {
            const player = game['Player'];
            if (!player || !playerStats[player]) return;
            
            const stats = playerStats[player];
            stats.Games++;
            
            const result = game['Result'];
            if (result === 'Win') {
                stats.Wins++;
                stats.TotalPoints += 3;
            } else if (result === 'Draw') {
                stats.Draws++;
                stats.TotalPoints += 1;
            } else if (result === 'Loss') {
                stats.Losses++;
            }
            
            stats.Goals += parseInt(game['Gls']) || 0;
            stats.OwnGoals += parseInt(game['OG']) || 0;
            stats.Assists += parseInt(game['Ast']) || 0;
            stats.Penalties += parseInt(game['Pen']) || 0;
        });
        
        Object.values(playerStats).forEach(stats => {
            if (stats.Games > 0) {
                stats.PPG = Math.round((stats.TotalPoints / stats.Games) * 10) / 10;
                stats.WinPercent = Math.round((stats.Wins / stats.Games) * 100 * 10) / 10;
            }
        });
        
        this.leagueTable = Object.values(playerStats)
            .sort((a, b) => {
                if (b.TotalPoints !== a.TotalPoints) return b.TotalPoints - a.TotalPoints;
                if (b.PPG !== a.PPG) return b.PPG - a.PPG;
                if (b.WinPercent !== a.WinPercent) return b.WinPercent - a.WinPercent;
                if (b.Goals !== a.Goals) return b.Goals - a.Goals;
                return a.Player.localeCompare(b.Player);
            });
    }
    
    async fetchCSV(filename) {
        try {
            const response = await fetch(filename);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        } catch (error) {
            console.warn(`Failed to fetch ${filename}:`, error);
            return null;
        }
    }
    
    parseCSV(csvText) {
        if (!csvText || csvText.trim() === '') return [];
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const headers = this.parseCSVLine(lines[0]).map(h => h.replace(/^"(.*)"$/, '$1').trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === 0) continue;
            
            const row = {};
            headers.forEach((header, index) => {
                if (values[index] !== undefined) {
                    let value = values[index].replace(/^"(.*)"$/, '$1').trim();
                    if (['Gls', 'OG', 'Ast', 'Pen'].includes(header) && !isNaN(value) && value !== '') {
                        value = Number(value);
                    }
                    row[header] = value;
                }
            });
            if (Object.keys(row).length > 0 && row[headers[0]]) data.push(row);
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
            } else { currentValue += char; }
        }
        values.push(currentValue);
        return values;
    }
    
    initLeagueTable() {
        if ($.fn.DataTable.isDataTable('#leagueTable')) {
            $('#leagueTable').DataTable().destroy();
        }
        
        const columns = [
            { data: 'Player', className: 'fw-bold clickable-player' },
            { data: 'Games', className: 'text-center' },
            { data: 'Wins', className: 'text-center' },
            { data: 'Draws', className: 'text-center' },
            { data: 'Losses', className: 'text-center' },
            { data: 'Goals', className: 'text-center fw-bold text-primary', render: d => `<span class="goals-highlight">${d}</span>` },
            { data: 'OwnGoals', className: 'text-center' },
            { data: 'Assists', className: 'text-center' },
            { data: 'Penalties', className: 'text-center' },
            { data: 'TotalPoints', className: 'text-center fw-bold text-success', render: d => `<strong class="points-badge">${d}</strong>` },
            { data: 'PPG', className: 'text-center fw-bold', render: d => `<span class="ppg-value">${d.toFixed(1)}</span>` },
            { 
                data: 'WinPercent', 
                className: 'text-center',
                render: d => `<span style="color: ${d >= 60 ? '#198754' : d >= 40 ? '#fd7e14' : '#dc3545'}; font-weight: bold">${d}%</span>` 
            }
        ];
        
        $('#leagueTable').DataTable({
            data: this.leagueTable,
            columns: columns,
            order: [[9, 'desc']],
            pageLength: 25,
            stateSave: false,
            responsive: true
        });

        $('#leagueTable tbody').off('click', 'td:first-child').on('click', 'td:first-child', (event) => {
            const playerName = $(event.target).text().trim();
            if (playerName && this.players.includes(playerName)) {
                this.selectPlayer(playerName);
            }
        });
    }
    
    initPlayerSelector() {
        const select = $('#playerSelect');
        select.empty().append('<option value="">Choose a player...</option>');
        
        this.players.forEach(player => {
            select.append(`<option value="${player}">${player}</option>`);
        });
        
        select.off('change').on('change', (e) => {
            if (e.target.value) this.selectPlayer(e.target.value);
        });
    }
    
    selectPlayer(playerName) {
        this.selectedPlayer = playerName;
        $('#playerSelect').val(playerName);
        this.showPlayerAnalysis(playerName);
    }
    
    showPlayerAnalysis(playerName) {
        $('#playerName').text(playerName);
        const playerStats = this.leagueTable.find(row => row.Player === playerName);
        
        if (playerStats) {
            $('#totalGames').text(playerStats.Games);
            $('#totalPoints').text(playerStats.TotalPoints);
            $('#totalGoals').text(playerStats.Goals);
            $('#totalAssists').text(playerStats.Assists);
            $('#totalOwnGoals').text(playerStats.OwnGoals);
            $('#goalContributions').text(playerStats.Goals + playerStats.Assists);
        }
        
        $('#playerStats').show();
        $('#shareButton').prop('disabled', false);
        this.showPartnershipAnalysis(playerName);
    }

    showPartnershipAnalysis(selectedPlayer) {
        const analysisData = [];
        
        this.players.forEach(otherPlayer => {
            if (otherPlayer === selectedPlayer) return;
            
            const selectedGames = this.gameLog.filter(game => game['Player'] === selectedPlayer);
            const otherGames = this.gameLog.filter(game => game['Player'] === otherPlayer);
            
            let gamesInCommon = 0, sameTeamGames = 0, winTogether = 0, oppositeTeamGames = 0, selectedWinsVsOther = 0;
            
            const selectedGameMap = {};
            selectedGames.forEach(g => { selectedGameMap[g['ID'] + '|' + g['Team']] = g; });
            
            const otherGameMap = {};
            otherGames.forEach(g => { otherGameMap[g['ID'] + '|' + g['Team']] = g; });
            
            Object.keys(selectedGameMap).forEach(key => {
                if (otherGameMap[key]) {
                    gamesInCommon++;
                    sameTeamGames++;
                    if (selectedGameMap[key]['Result'] === 'Win') winTogether++;
                }
            });
            
            selectedGames.forEach(sGame => {
                otherGames.forEach(oGame => {
                    if (sGame['ID'] === oGame['ID'] && sGame['Team'] !== oGame['Team']) {
                        gamesInCommon++;
                        oppositeTeamGames++;
                        if (sGame['Result'] === 'Win') selectedWinsVsOther++;
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
        
        this.populatePartnershipTable(analysisData);
    }

    populatePartnershipTable(data) {
        if ($.fn.DataTable.isDataTable('#partnershipTable')) {
            $('#partnershipTable').DataTable().destroy();
        }

        const tableBody = $('#partnershipTable tbody');
        tableBody.empty();
        
        data.forEach(item => {
            tableBody.append(`
                <tr>
                    <td class="fw-bold clickable-player">${item.player}</td>
                    <td class="text-center">${item.gamesInCommon}</td>
                    <td class="text-center">${item.sameTeam}</td>
                    <td class="text-center">${item.oppositeTeam || '-'}</td>
                    <td class="text-center">${item.sameTeam > 0 ? item.winPercentTogether + '%' : '-'}</td>
                    <td class="text-center">${item.oppositeTeam > 0 ? item.h2hWinPercent + '%' : '-'}</td>
                </tr>
            `);
        });

        $('#partnershipTable').DataTable({
            paging: false, searching: false, info: false, order: [[1, 'desc']], responsive: true
        });
    }

    updateLastUpdated() {
        fetch(this.currentCsv, { method: 'HEAD' })
            .then(res => {
                const lm = res.headers.get('last-modified');
                $('#lastUpdated').text(lm ? new Date(lm).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB'));
            })
            .catch(() => $('#lastUpdated').text(new Date().toLocaleDateString('en-GB')));
    }

    showLoading(show) { $('#loadingIndicator').toggle(show); }
    showError(msg) { alert(msg); }
}

document.addEventListener('DOMContentLoaded', () => { window.sidewindersApp = new SidewindersStats(); });
