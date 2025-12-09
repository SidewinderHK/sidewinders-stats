// Sidewinders Stats - Updated with PPG and Win %
class SidewindersStats {
    constructor() {
        this.gameLog = [];
        this.leagueTable = [];
        this.players = [];
        this.selectedPlayer = null;
        
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
            this.updateLastUpdated();
            this.showLoading(false);
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to load data. Please check GameLog.csv file.');
            this.showLoading(false);
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
    
    calculateLeagueTable() {
        console.log('Calculating league table from game log...');
        
        const playerStats = {};
        
        this.players.forEach(player => {
            playerStats[player] = {
                Player: player,
                Games: 0,
                Wins: 0,
                Draws: 0,
                Losses: 0,
                Goals: 0,
                OwnGoals: 0,
                Assists: 0,
                Penalties: 0,
                TotalPoints: 0,
                PPG: 0, // Points Per Game
                WinPercent: 0 // Win Percentage
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
        
        // Calculate PPG and Win Percent for each player
        Object.values(playerStats).forEach(stats => {
            if (stats.Games > 0) {
                // Points Per Game (1 decimal place)
                stats.PPG = Math.round((stats.TotalPoints / stats.Games) * 10) / 10;
                // Win Percentage (1 decimal place)
                stats.WinPercent = Math.round((stats.Wins / stats.Games) * 100 * 10) / 10;
            }
        });
        
        this.leagueTable = Object.values(playerStats)
            .sort((a, b) => {
                if (b.TotalPoints !== a.TotalPoints) return b.TotalPoints - a.TotalPoints;
                if (b.PPG !== a.PPG) return b.PPG - a.PPG;
                if (b.WinPercent !== a.WinPercent) return b.WinPercent - a.WinPercent;
                if (b.Goals !== a.Goals) return b.Goals - a.Goals;
                if (b.Assists !== a.Assists) return b.Assists - a.Assists;
                return a.Player.localeCompare(b.Player);
            });
        
        console.log('League table calculated:', this.leagueTable.length, 'players');
    }
    
    async fetchCSV(filename) {
        try {
            const response = await fetch(filename);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.text();
        } catch (error) {
            console.warn(`Failed to fetch ${filename}:`, error);
            return null;
        }
    }
    
    parseCSV(csvText) {
        if (!csvText || csvText.trim() === '') {
            return [];
        }
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const headers = this.parseCSVLine(lines[0]).map(h => 
            h.replace(/^"(.*)"$/, '$1').trim()
        );
        
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === 0) continue;
            
            const row = {};
            headers.forEach((header, index) => {
                if (values[index] !== undefined) {
                    let value = values[index];
                    value = value.replace(/^"(.*)"$/, '$1').trim();
                    
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
                if (insideQuotes && nextChar === '"') {
                    currentValue += '"';
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }
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
    
    initLeagueTable() {
        if (this.leagueTable.length === 0) {
            $('#leagueTable').html('<tr><td colspan="12" class="text-center">No game data available</td></tr>');
            return;
        }
        
        if ($.fn.DataTable.isDataTable('#leagueTable')) {
            $('#leagueTable').DataTable().destroy();
        }
        
        const table = $('#leagueTable').DataTable({
            data: this.leagueTable,
            columns: [
                { 
                    data: 'Player',
                    className: 'fw-bold clickable-player',
                    render: function(data, type, row) {
                        return `<span class="clickable-player">${data}</span>`;
                    }
                },
                { 
                    data: 'Games',
                    className: 'text-center',
                    title: 'Games'
                },
                { 
                    data: 'Wins',
                    className: 'text-center',
                    title: 'Wins'
                },
                { 
                    data: 'Draws',
                    className: 'text-center',
                    title: 'Draws'
                },
                { 
                    data: 'Losses',
                    className: 'text-center',
                    title: 'Losses'
                },
                { 
                    data: 'Goals',
                    className: 'text-center fw-bold text-primary',
                    title: 'Goals'
                },
                { 
                    data: 'OwnGoals',
                    className: 'text-center',
                    title: 'Own Goals'
                },
                { 
                    data: 'Assists',
                    className: 'text-center',
                    title: 'Assists'
                },
                { 
                    data: 'Penalties',
                    className: 'text-center',
                    title: 'Penalties'
                },
                { 
                    data: 'TotalPoints',
                    className: 'text-center fw-bold text-success',
                    title: 'Total Points',
                    render: function(data, type, row) {
                        if (type === 'sort' || type === 'type') {
                            return data;
                        }
                        return `<strong class="points-badge">${data}</strong>`;
                    }
                },
                { 
                    data: 'PPG',
                    className: 'text-center fw-bold',
                    title: 'PPG',
                    render: function(data, type, row) {
                        if (type === 'sort' || type === 'type') {
                            return data;
                        }
                        return `<span class="ppg-value">${data.toFixed(1)}</span>`;
                    }
                },
                { 
                    data: 'WinPercent',
                    className: 'text-center',
                    title: 'Win %',
                    render: function(data, type, row) {
                        if (type === 'sort' || type === 'type') {
                            return data;
                        }
                        let color = '#dc3545'; // red
                        if (data >= 60) color = '#198754'; // green
                        else if (data >= 40) color = '#fd7e14'; // orange
                        
                        return `<span style="color: ${color}; font-weight: bold">${data}%</span>`;
                    }
                }
            ],
            order: [[9, 'desc']], // Default sort by Total Points (column 9) descending
            pageLength: 25,
            responsive: true,
            language: {
                search: "Search players:",
                lengthMenu: "Show _MENU_ entries",
                info: "Showing _START_ to _END_ of _TOTAL_ players"
            }
        });
        
        $('#leagueTable tbody').on('click', 'td:first-child', (event) => {
            const playerName = $(event.target).text().trim();
            if (playerName && this.players.includes(playerName)) {
                this.selectPlayer(playerName);
                $('html, body').animate({
                    scrollTop: $('#analysis').offset().top - 20
                }, 500);
            }
        });
    }
    
    initPlayerSelector() {
        const select = $('#playerSelect');
        select.empty();
        select.append('<option value="">Choose a player...</option>');
        
        this.players.forEach(player => {
            select.append(`<option value="${player}">${player}</option>`);
        });
        
        select.off('change').on('change', (e) => {
            const player = e.target.value;
            if (player) {
                this.selectPlayer(player);
            }
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
            $('#totalWins').text(playerStats.Wins);
            $('#totalDraws').text(playerStats.Draws);
            $('#totalLosses').text(playerStats.Losses);
            $('#totalPoints').text(playerStats.TotalPoints);
            $('#totalGoals').text(playerStats.Goals);
            $('#totalAssists').text(playerStats.Assists);
            $('#totalOwnGoals').text(playerStats.OwnGoals);
            $('#totalPenalties').text(playerStats.Penalties);
            
            // Calculate Goal Contributions (Goals + Assists, excluding Own Goals)
            const goalContributions = playerStats.Goals + playerStats.Assists;
            $('#goalContributions').text(goalContributions);
            
            // Calculate win percentage
            $('#winPercent').text(playerStats.WinPercent + '%');
            $('#winPercentBar').css('width', playerStats.WinPercent + '%');
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
            
            let gamesInCommon = 0;
            let sameTeamGames = 0;
            let winTogether = 0;
            let oppositeTeamGames = 0;
            let selectedWinsVsOther = 0;
            
            const selectedGameMap = {};
            selectedGames.forEach(game => {
                const key = game['ID'] + '|' + game['Team'];
                selectedGameMap[key] = game;
            });
            
            const otherGameMap = {};
            otherGames.forEach(game => {
                const key = game['ID'] + '|' + game['Team'];
                otherGameMap[key] = game;
            });
            
            Object.keys(selectedGameMap).forEach(key => {
                if (otherGameMap[key]) {
                    gamesInCommon++;
                    sameTeamGames++;
                    
                    if (selectedGameMap[key]['Result'] === 'Win') {
                        winTogether++;
                    }
                }
            });
            
            selectedGames.forEach(sGame => {
                otherGames.forEach(oGame => {
                    if (sGame['ID'] === oGame['ID'] && sGame['Team'] !== oGame['Team']) {
                        gamesInCommon++;
                        oppositeTeamGames++;
                        
                        if (sGame['Result'] === 'Win') {
                            selectedWinsVsOther++;
                        }
                    }
                });
            });
            
            if (gamesInCommon > 0) {
                const winPercentTogether = sameTeamGames > 0 ? 
                    Math.round((winTogether / sameTeamGames) * 100) : 0;
                
                const h2hWinPercent = oppositeTeamGames > 0 ? 
                    Math.round((selectedWinsVsOther / oppositeTeamGames) * 100) : 0;
                
                analysisData.push({
                    player: otherPlayer,
                    gamesInCommon: gamesInCommon,
                    sameTeam: sameTeamGames,
                    oppositeTeam: oppositeTeamGames,
                    winTogether: winTogether,
                    winPercentTogether: winPercentTogether,
                    h2hWinPercent: h2hWinPercent
                });
            }
        });
        
        analysisData.sort((a, b) => {
            if (b.gamesInCommon !== a.gamesInCommon) {
                return b.gamesInCommon - a.gamesInCommon;
            }
            return b.winPercentTogether - a.winPercentTogether;
        });
        
        const tableBody = $('#partnershipTable tbody');
        tableBody.empty();
        
        if (analysisData.length === 0) {
            tableBody.append(`
                <tr>
                    <td colspan="6" class="text-center text-muted">
                        No partnership data available for this player
                    </td>
                </tr>
            `);
            return;
        }
        
        analysisData.forEach(data => {
            const winTogetherClass = data.winPercentTogether >= 60 ? 'table-success-light' :
                                   data.winPercentTogether <= 30 ? 'table-danger-light' : '';
            
            const h2hClass = data.h2hWinPercent >= 60 ? 'table-success-light' :
                           data.h2hWinPercent <= 30 && data.oppositeTeam > 0 ? 'table-danger-light' : '';
            
            const row = `
                <tr>
                    <td class="fw-bold clickable-player" onclick="window.sidewindersApp.selectPlayer('${data.player.replace(/'/g, "\\'")}')">
                        ${data.player}
                    </td>
                    <td class="text-center">${data.gamesInCommon}</td>
                    <td class="text-center">${data.sameTeam}</td>
                    <td class="text-center">${data.oppositeTeam > 0 ? data.oppositeTeam : '-'}</td>
                    <td class="text-center ${winTogetherClass}">
                        ${data.sameTeam > 0 ? data.winPercentTogether + '%' : '-'}
                    </td>
                    <td class="text-center ${h2hClass}">
                        ${data.oppositeTeam > 0 ? data.h2hWinPercent + '%' : '-'}
                    </td>
                </tr>
            `;
            tableBody.append(row);
        });
    }
    
    updateLastUpdated() {
        fetch('GameLog.csv', { method: 'HEAD' })
            .then(response => {
                const lastModified = response.headers.get('last-modified');
                if (lastModified) {
                    const date = new Date(lastModified);
                    $('#lastUpdated').text(date.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }));
                } else {
                    const now = new Date();
                    $('#lastUpdated').text(now.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    }));
                }
            })
            .catch(() => {
                const now = new Date();
                $('#lastUpdated').text(now.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }));
            });
    }
    
    showLoading(show) {
        if (show) {
            $('#loadingIndicator').show();
        } else {
            $('#loadingIndicator').hide();
        }
    }
    
    showError(message) {
        const errorHtml = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <strong>Error:</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        $('.container').prepend(errorHtml);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    window.sidewindersApp = new SidewindersStats();
    
    $('a[href="#league"]').click(function(e) {
        e.preventDefault();
        $('html, body').animate({
            scrollTop: $('#league').offset().top - 20
        }, 500);
    });
    
    $('a[href="#analysis"]').click(function(e) {
        e.preventDefault();
        $('html, body').animate({
            scrollTop: $('#analysis').offset().top - 20
        }, 500);
    });
});

function shareCurrentPlayer() {
    const playerSelect = document.getElementById('playerSelect');
    const playerName = playerSelect.value;
    
    if (!playerName) {
        alert('Please select a player first.');
        return;
    }
    
    const url = new URL(window.location.href);
    url.hash = `player-${encodeURIComponent(playerName)}`;
    
    navigator.clipboard.writeText(url.toString())
        .then(() => {
            const toast = `<div class="toast show position-fixed bottom-0 end-0 m-3" role="alert">
                <div class="toast-header bg-success text-white">
                    <strong class="me-auto">Success!</strong>
                    <button type="button" class="btn-close btn-close-white" onclick="this.parentElement.parentElement.remove()"></button>
                </div>
                <div class="toast-body">
                    Link to ${playerName}'s analysis copied to clipboard!
                </div>
            </div>`;
            $('body').append(toast);
            setTimeout(() => $('.toast').remove(), 3000);
        })
        .catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy link. You can manually copy the URL from your browser.');
        });
}
