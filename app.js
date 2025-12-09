// Sidewinders Stats - Fixed mobile loading and columns
class SidewindersStats {
    constructor() {
        this.gameLog = [];
        this.leagueTable = [];
        this.players = [];
        this.selectedPlayer = null;
        this.isLoading = false;
        
        // Initialize when DOM is ready
        $(document).ready(() => {
            console.log('DOM ready, initializing app...');
            this.init();
        });
    }
    
    async init() {
        try {
            console.log('Starting initialization...');
            this.showLoading(true);
            this.isLoading = true;
            
            await this.loadAllData();
            console.log('Data loaded, calculating league table...');
            
            this.calculateLeagueTable();
            console.log('League table calculated, initializing components...');
            
            this.initLeagueTable();
            this.initPlayerSelector();
            this.updateLastUpdated();
            
            this.isLoading = false;
            this.showLoading(false);
            console.log('Initialization complete!');
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to load data. Please check GameLog.csv file.');
            this.showLoading(false);
            this.isLoading = false;
        }
    }
    
    async loadAllData() {
        console.log('Loading CSV data...');
        try {
            // First try to load the CSV
            const gameLogCSV = await this.fetchCSV('GameLog.csv');
            
            if (!gameLogCSV) {
                throw new Error('GameLog.csv is empty or not found');
            }
            
            console.log('CSV loaded, parsing data...');
            this.gameLog = this.parseCSV(gameLogCSV);
            
            if (this.gameLog.length === 0) {
                throw new Error('No data found in GameLog.csv');
            }
            
            // Extract unique players
            this.players = [...new Set(this.gameLog.map(row => row['Player']))]
                .filter(name => name && name.trim() !== '')
                .sort();
            
            console.log(`Loaded ${this.gameLog.length} game records`);
            console.log(`Found ${this.players.length} unique players`);
            
        } catch (error) {
            console.error('Error in loadAllData:', error);
            throw error;
        }
    }
    
    calculateLeagueTable() {
        console.log('Calculating league table from game log...');
        
        const playerStats = {};
        
        // Initialize all players
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
                PPG: 0,
                WinPercent: 0
            };
        });
        
        // Process each game record
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
                stats.PPG = Math.round((stats.TotalPoints / stats.Games) * 10) / 10;
                stats.WinPercent = Math.round((stats.Wins / stats.Games) * 100 * 10) / 10;
            }
        });
        
        // Sort by Total Points, then PPG, then Win Percent
        this.leagueTable = Object.values(playerStats)
            .sort((a, b) => {
                if (b.TotalPoints !== a.TotalPoints) return b.TotalPoints - a.TotalPoints;
                if (b.PPG !== a.PPG) return b.PPG - a.PPG;
                if (b.WinPercent !== a.WinPercent) return b.WinPercent - a.WinPercent;
                if (b.Goals !== a.Goals) return b.Goals - a.Goals;
                if (b.Assists !== a.Assists) return b.Assists - a.Assists;
                return a.Player.localeCompare(b.Player);
            });
        
        console.log(`League table calculated: ${this.leagueTable.length} players`);
    }
    
    async fetchCSV(filename) {
        console.log(`Fetching ${filename}...`);
        try {
            // Use cache-busting for mobile to avoid stale data
            const url = `${filename}?t=${Date.now()}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch ${filename}: ${response.status} ${response.statusText}`);
            }
            
            const text = await response.text();
            console.log(`${filename} loaded successfully (${text.length} chars)`);
            return text;
            
        } catch (error) {
            console.error(`Error fetching ${filename}:`, error);
            
            // Try alternative approach for mobile
            try {
                console.log('Trying alternative fetch method...');
                const response = await fetch(filename, {
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache'
                    }
                });
                return await response.text();
            } catch (retryError) {
                console.error('Alternative fetch also failed:', retryError);
                return null;
            }
        }
    }
    
    parseCSV(csvText) {
        if (!csvText || csvText.trim() === '') {
            console.warn('CSV text is empty');
            return [];
        }
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            console.warn('CSV has less than 2 lines');
            return [];
        }
        
        // Parse headers
        const headers = this.parseCSVLine(lines[0]).map(h => 
            h.replace(/^"(.*)"$/, '$1').trim()
        );
        
        console.log('CSV headers:', headers);
        
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
        
        console.log(`Parsed ${data.length} rows from CSV`);
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
        console.log('Initializing league table...');
        
        if (this.leagueTable.length === 0) {
            $('#leagueTable').html('<tr><td colspan="12" class="text-center">No game data available</td></tr>');
            return;
        }
        
        // Destroy existing DataTable if it exists
        if ($.fn.DataTable.isDataTable('#leagueTable')) {
            $('#leagueTable').DataTable().destroy();
            $('#leagueTable').empty();
        }
        
        // Create table with proper mobile scrolling
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
                        let color = '#dc3545';
                        if (data >= 60) color = '#198754';
                        else if (data >= 40) color = '#fd7e14';
                        
                        return `<span style="color: ${color}; font-weight: bold">${data}%</span>`;
                    }
                }
            ],
            order: [[9, 'desc']], // Default sort by Total Points (column 9)
            pageLength: 25,
            responsive: true,
            scrollX: true,
            scrollCollapse: true,
            fixedHeader: true,
            language: {
                search: "Search players:",
                lengthMenu: "Show _MENU_ entries",
                info: "Showing _START_ to _END_ of _TOTAL_ players"
            },
            initComplete: function() {
                console.log('DataTable initialization complete');
            }
        });
        
        // Click handler for player names
        $('#leagueTable').on('click', 'tbody td:first-child', (event) => {
            const playerName = $(event.target).text().trim();
            if (playerName && this.players.includes(playerName)) {
                this.selectPlayer(playerName);
                $('html, body').animate({
                    scrollTop: $('#analysis').offset().top - 20
                }, 500);
            }
        });
        
        console.log('League table initialized with', this.leagueTable.length, 'players');
    }
    
    initPlayerSelector() {
        console.log('Initializing player selector...');
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
        
        console.log('Player selector initialized with', this.players.length, 'players');
    }
    
    selectPlayer(playerName) {
        console.log('Selecting player:', playerName);
        this.selectedPlayer = playerName;
        $('#playerSelect').val(playerName);
        this.showPlayerAnalysis(playerName);
    }
    
    showPlayerAnalysis(playerName) {
        console.log('Showing analysis for:', playerName);
        $('#playerName').text(playerName);
        
        const playerStats = this.leagueTable.find(row => row.Player === playerName);
        
        if (playerStats) {
            // Update all stats
            $('#totalGames').text(playerStats.Games);
            $('#totalWins').text(playerStats.Wins);
            $('#totalDraws').text(playerStats.Draws);
            $('#totalLosses').text(playerStats.Losses);
            $('#totalPoints').text(playerStats.TotalPoints);
            $('#totalGoals').text(playerStats.Goals);
            $('#totalAssists').text(playerStats.Assists);
            $('#totalOwnGoals').text(playerStats.OwnGoals);
            $('#totalPenalties').text(playerStats.Penalties);
            
            // Calculate Goal Contributions (Goals + Assists)
            const goalContributions = playerStats.Goals + playerStats.Assists;
            $('#goalContributions').text(goalContributions);
            
            // Set win percentage
            $('#winPercent').text(playerStats.WinPercent + '%');
            $('#winPercentBar').css('width', playerStats.WinPercent + '%');
        }
        
        // Show the stats section
        $('#playerStats').show();
        
        // Enable share button
        $('#shareButton').prop('disabled', false);
        
        // Show partnership analysis
        this.showPartnershipAnalysis(playerName);
    }
    
    showPartnershipAnalysis(selectedPlayer) {
        console.log('Calculating partnerships for:', selectedPlayer);
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
        
        console.log('Partnership analysis complete:', analysisData.length, 'teammates');
    }
    
    updateLastUpdated() {
        // Use cache busting for mobile
        fetch('GameLog.csv?t=' + Date.now(), { method: 'HEAD' })
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
            $('.stat-card').addClass('opacity-50');
        } else {
            $('#loadingIndicator').hide();
            $('.stat-card').removeClass('opacity-50');
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

// Initialize the application when page loads
$(document).ready(function() {
    console.log('Document ready, starting app...');
    window.sidewindersApp = new SidewindersStats();
    
    // Navigation smooth scrolling
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
    
    // Add mobile-friendly touch events
    if ('ontouchstart' in window) {
        $('.clickable-player').css('cursor', 'pointer');
    }
});

// Helper function to share player analysis
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
            // Show toast notification
            const toast = `<div class="toast show position-fixed bottom-0 end-0 m-3" style="z-index: 9999">
                <div class="toast-header bg-success text-white">
                    <strong class="me-auto"><i class="fas fa-check-circle me-1"></i> Success</strong>
                    <button type="button" class="btn-close btn-close-white" onclick="this.parentElement.parentElement.remove()"></button>
                </div>
                <div class="toast-body">
                    Link to ${playerName}'s analysis copied to clipboard!
                </div>
            </div>`;
            
            // Remove any existing toasts
            $('.toast').remove();
            $('body').append(toast);
            
            // Auto-remove after 3 seconds
            setTimeout(() => {
                $('.toast').remove();
            }, 3000);
        })
        .catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy link. You can manually copy the URL from your browser.');
        });
}

// Debug function to check if everything loaded
function debugApp() {
    console.log('=== DEBUG INFO ===');
    console.log('GameLog records:', window.sidewindersApp?.gameLog?.length || 0);
    console.log('League table:', window.sidewindersApp?.leagueTable?.length || 0);
    console.log('Players:', window.sidewindersApp?.players?.length || 0);
    console.log('Selected player:', window.sidewindersApp?.selectedPlayer);
    console.log('Is loading:', window.sidewindersApp?.isLoading);
    console.log('==================');
}
