// Sidewinders Stats - Updated for your exact CSV formats
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
            this.initLeagueTable();
            this.initPlayerSelector();
            this.updateLastUpdated();
            this.showLoading(false);
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to load data. Please check your CSV files.');
            this.showLoading(false);
        }
    }
    
    async loadAllData() {
        try {
            // Load GameLog.csv with your format
            const gameLogCSV = await this.fetchCSV('GameLog.csv');
            this.gameLog = this.parseCSV(gameLogCSV);
            
            // Load LeagueTable.csv with your format
            const leagueTableCSV = await this.fetchCSV('LeagueTable.csv');
            this.leagueTable = this.parseCSV(leagueTableCSV);
            
            // Extract unique players from game log
            this.players = [...new Set(this.gameLog.map(row => row['Player']))]
                .filter(name => name && name.trim() !== '')
                .sort();
            
            console.log(`Loaded ${this.gameLog.length} game records`);
            console.log(`Loaded ${this.leagueTable.length} league table entries`);
            
            // Debug: Show column names
            if (this.gameLog.length > 0) {
                console.log('GameLog columns:', Object.keys(this.gameLog[0]));
            }
            if (this.leagueTable.length > 0) {
                console.log('LeagueTable columns:', Object.keys(this.leagueTable[0]));
                console.log('Sample league row:', this.leagueTable[0]);
            }
            
        } catch (error) {
            console.error('Error loading CSV files:', error);
            throw error;
        }
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
        
        // Parse headers
        const headers = this.parseCSVLine(lines[0]).map(h => 
            h.replace(/^"(.*)"$/, '$1').trim()
        );
        
        // Parse data rows
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === 0) continue;
            
            const row = {};
            headers.forEach((header, index) => {
                if (values[index] !== undefined) {
                    let value = values[index];
                    value = value.replace(/^"(.*)"$/, '$1').trim();
                    
                    // Convert numeric columns
                    const numericColumns = [
                        'Gls', 'OG', 'Ast', 'Pen',  // GameLog
                        'P', 'W', 'D', 'L', 'Gls', 'OG', 'Ast', 'Pts',  // LeagueTable
                        'Appearances', 'Wins', 'Draws', 'Losses', 'Goals', 'Assists' // Legacy
                    ];
                    
                    // Special handling for Column 1-18 (might be empty or numeric)
                    const isColumnNumber = header.startsWith('Column ');
                    const columnNum = parseInt(header.replace('Column ', ''));
                    
                    if ((numericColumns.includes(header) || isColumnNumber) && 
                        !isNaN(value) && value !== '') {
                        value = Number(value);
                    }
                    
                    row[header] = value;
                }
            });
            
            // Only add row if it has data
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
            $('#leagueTable').html('<tr><td colspan="9" class="text-center">No league data available</td></tr>');
            return;
        }
        
        if ($.fn.DataTable.isDataTable('#leagueTable')) {
            $('#leagueTable').DataTable().destroy();
        }
        
        // Create a transformed dataset with calculated fields
        const transformedData = this.leagueTable.map(row => {
            // Calculate Win Rate % from W, D, L
            const games = parseInt(row['P']) || 0;
            const wins = parseInt(row['W']) || 0;
            const draws = parseInt(row['D']) || 0;
            const losses = parseInt(row['L']) || 0;
            
            // Calculate Win Rate %
            let winRate = 0;
            if (games > 0) {
                winRate = Math.round((wins / games) * 100 * 10) / 10; // 1 decimal place
            }
            
            // Calculate Points Per Game (PPG)
            let ppg = 0;
            const points = parseInt(row['Pts']) || 0;
            if (games > 0) {
                ppg = Math.round((points / games) * 10) / 10; // 1 decimal place
            }
            
            // Create a clean object for DataTables
            return {
                Player: row['Player'],
                Games: games,
                Wins: wins,
                Draws: draws,
                Losses: losses,
                Goals: parseInt(row['Gls']) || 0,
                Assists: parseInt(row['Ast']) || 0,
                OwnGoals: parseInt(row['OG']) || 0,
                Points: points,
                WinRate: winRate,
                PPG: ppg
            };
        });
        
        // Initialize DataTable with YOUR league columns
        const table = $('#leagueTable').DataTable({
            data: transformedData,
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
                    title: 'P'
                },
                { 
                    data: 'Wins',
                    className: 'text-center',
                    title: 'W'
                },
                { 
                    data: 'Draws',
                    className: 'text-center',
                    title: 'D'
                },
                { 
                    data: 'Losses',
                    className: 'text-center',
                    title: 'L'
                },
                { 
                    data: 'Goals',
                    className: 'text-center fw-bold text-primary',
                    title: 'Gls'
                },
                { 
                    data: 'Assists',
                    className: 'text-center',
                    title: 'Ast'
                },
                { 
                    data: 'WinRate',
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
                },
                { 
                    data: 'PPG',
                    className: 'text-center fw-bold',
                    title: 'PPG',
                    render: function(data, type, row) {
                        if (type === 'sort' || type === 'type') {
                            return data;
                        }
                        return data.toFixed(1);
                    }
                }
            ],
            order: [[7, 'desc']], // Sort by Win Rate % descending
            pageLength: 25,
            responsive: true,
            language: {
                search: "Search players:",
                lengthMenu: "Show _MENU_ entries",
                info: "Showing _START_ to _END_ of _TOTAL_ players"
            }
        });
        
        // Click handler for player names
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
        
        // Use players from both GameLog and LeagueTable for completeness
        const allPlayers = [...new Set([...this.players, ...this.leagueTable.map(row => row['Player'])])]
            .filter(name => name && name.trim() !== '')
            .sort();
        
        allPlayers.forEach(player => {
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
        // Update player name display
        $('#playerName').text(playerName);
        
        // Get league data for this player
        const leagueData = this.leagueTable.find(row => row['Player'] === playerName);
        
        if (leagueData) {
            // Display league stats
            const games = parseInt(leagueData['P']) || 0;
            const wins = parseInt(leagueData['W']) || 0;
            const draws = parseInt(leagueData['D']) || 0;
            const losses = parseInt(leagueData['L']) || 0;
            const goals = parseInt(leagueData['Gls']) || 0;
            const assists = parseInt(leagueData['Ast']) || 0;
            const ownGoals = parseInt(leagueData['OG']) || 0;
            const points = parseInt(leagueData['Pts']) || 0;
            
            const winPercent = games > 0 ? Math.round((wins / games) * 100) : 0;
            const pointsPerGame = games > 0 ? Math.round((points / games) * 10) / 10 : 0;
            
            // Update basic stats cards
            $('#totalGames').text(games);
            $('#totalWins').text(wins);
            $('#totalDraws').text(draws);
            $('#totalLosses').text(losses);
            $('#winPercent').text(winPercent + '%');
            $('#pointsPerGame').text(pointsPerGame.toFixed(1));
            $('#totalGoals').text(goals);
            $('#totalAssists').text(assists);
            $('#totalOwnGoals').text(ownGoals);
            
            // Update win percentage progress bar
            $('#winPercentBar').css('width', winPercent + '%');
        } else {
            // Fallback to calculating from GameLog
            const playerGames = this.gameLog.filter(game => game['Player'] === playerName);
            
            const totalGames = playerGames.length;
            const wins = playerGames.filter(game => game['Result'] === 'Win').length;
            const draws = playerGames.filter(game => game['Result'] === 'Draw').length;
            const losses = playerGames.filter(game => game['Result'] === 'Loss').length;
            const goals = playerGames.reduce((sum, game) => sum + (parseInt(game['Gls']) || 0), 0);
            const assists = playerGames.reduce((sum, game) => sum + (parseInt(game['Ast']) || 0), 0);
            const ownGoals = playerGames.reduce((sum, game) => sum + (parseInt(game['OG']) || 0), 0);
            
            const winPercent = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
            const points = (wins * 3) + draws;
            const pointsPerGame = totalGames > 0 ? Math.round((points / totalGames) * 10) / 10 : 0;
            
            $('#totalGames').text(totalGames);
            $('#totalWins').text(wins);
            $('#totalDraws').text(draws);
            $('#totalLosses').text(losses);
            $('#winPercent').text(winPercent + '%');
            $('#pointsPerGame').text(pointsPerGame.toFixed(1));
            $('#totalGoals').text(goals);
            $('#totalAssists').text(assists);
            $('#totalOwnGoals').text(ownGoals);
            $('#winPercentBar').css('width', winPercent + '%');
        }
        
        // Show the stats section
        $('#playerStats').show();
        
        // Enable share button
        $('#shareButton').prop('disabled', false);
        
        // Calculate and show partnership analysis
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
            
            // Create maps for quick lookup
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
            
            // Find same team games
            Object.keys(selectedGameMap).forEach(key => {
                if (otherGameMap[key]) {
                    gamesInCommon++;
                    sameTeamGames++;
                    
                    if (selectedGameMap[key]['Result'] === 'Win') {
                        winTogether++;
                    }
                }
            });
            
            // Find opposite team games
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
        
        // Sort by games in common (descending)
        analysisData.sort((a, b) => {
            if (b.gamesInCommon !== a.gamesInCommon) {
                return b.gamesInCommon - a.gamesInCommon;
            }
            return b.winPercentTogether - a.winPercentTogether;
        });
        
        // Update partnership table
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
    
    // Navigation
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

// Helper functions
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
            // Show success toast
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
