// Sidewinders Stats - Complete Application
// Loads data from CSV files and provides interactive stats

class SidewindersStats {
    constructor() {
        this.gameLog = [];
        this.leagueTable = [];
        this.players = [];
        this.selectedPlayer = null;
        
        // Initialize when DOM is ready
        $(document).ready(() => {
            this.init();
        });
    }
    
    async init() {
        try {
            // Show loading state
            this.showLoading(true);
            
            // Load all data
            await this.loadAllData();
            
            // Initialize components
            this.initLeagueTable();
            this.initPlayerSelector();
            this.updateLastUpdated();
            
            // Hide loading state
            this.showLoading(false);
            
            // Show success message
            console.log('Sidewinders Stats loaded successfully!');
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to load data. Please check your CSV files.');
            this.showLoading(false);
        }
    }
    
    async loadAllData() {
        try {
            // Load GameLog.csv
            const gameLogCSV = await this.fetchCSV('GameLog.csv');
            this.gameLog = this.parseCSV(gameLogCSV);
            
            // Load LeagueTable.csv
            const leagueTableCSV = await this.fetchCSV('LeagueTable.csv');
            this.leagueTable = this.parseCSV(leagueTableCSV);
            
            // Extract unique players from game log
            this.players = [...new Set(this.gameLog.map(row => row['Player Name']))]
                .filter(name => name && name.trim() !== '')
                .sort();
            
            console.log(`Loaded ${this.gameLog.length} game records`);
            console.log(`Loaded ${this.leagueTable.length} league table entries`);
            console.log(`Found ${this.players.length} unique players`);
            
        } catch (error) {
            console.error('Error loading CSV files:', error);
            
            // Try alternative CSV file names
            console.log('Trying alternative file names...');
            try {
                const altGameLog = await this.fetchCSV('gamelog.csv') || 
                                   await this.fetchCSV('GameLog.csv') ||
                                   await this.fetchCSV('gamelog.CSV');
                
                if (altGameLog) {
                    this.gameLog = this.parseCSV(altGameLog);
                    this.players = [...new Set(this.gameLog.map(row => row['Player Name']))]
                        .filter(name => name && name.trim() !== '')
                        .sort();
                }
            } catch (altError) {
                throw new Error('Could not load CSV files. Please ensure GameLog.csv and LeagueTable.csv exist in the same folder.');
            }
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
        
        // Parse headers (handle quoted headers)
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
                    // Remove quotes if present
                    value = value.replace(/^"(.*)"$/, '$1').trim();
                    
                    // Convert numeric values
                    if (!isNaN(value) && value !== '') {
                        value = Number(value);
                    }
                    
                    row[header] = value;
                }
            });
            
            // Only add row if it has valid data
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
                    // Escaped quote
                    currentValue += '"';
                    i++; // Skip next char
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
        
        // Add last value
        values.push(currentValue);
        
        return values;
    }
    
    initLeagueTable() {
        if (this.leagueTable.length === 0) {
            $('#leagueTable').html('<tr><td colspan="9" class="text-center">No league data available</td></tr>');
            return;
        }
        
        // Destroy existing DataTable if it exists
        if ($.fn.DataTable.isDataTable('#leagueTable')) {
            $('#leagueTable').DataTable().destroy();
        }
        
        // Initialize DataTable
        const table = $('#leagueTable').DataTable({
            data: this.leagueTable,
            columns: [
                { 
                    data: 'Player',
                    className: 'fw-bold'
                },
                { 
                    data: 'Appearances',
                    className: 'text-center'
                },
                { 
                    data: 'Wins',
                    className: 'text-center'
                },
                { 
                    data: 'Draws',
                    className: 'text-center'
                },
                { 
                    data: 'Losses',
                    className: 'text-center'
                },
                { 
                    data: 'Goals',
                    className: 'text-center fw-bold text-primary'
                },
                { 
                    data: 'Assists',
                    className: 'text-center'
                },
                { 
                    data: 'Win Rate %',
                    className: 'text-center',
                    render: function(data, type, row) {
                        if (type === 'sort' || type === 'type') {
                            return parseFloat(data) || 0;
                        }
                        const value = parseFloat(data) || 0;
                        let color = '#dc3545'; // red
                        if (value >= 60) color = '#198754'; // green
                        else if (value >= 40) color = '#fd7e14'; // orange
                        
                        return `<span style="color: ${color}; font-weight: bold">${value}%</span>`;
                    }
                },
                { 
                    data: 'Points Per Game',
                    className: 'text-center fw-bold',
                    render: function(data, type, row) {
                        if (type === 'sort' || type === 'type') {
                            return parseFloat(data) || 0;
                        }
                        const value = parseFloat(data) || 0;
                        return value.toFixed(1);
                    }
                }
            ],
            order: [[7, 'desc']], // Sort by Win Rate % descending
            pageLength: 25,
            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
            responsive: true,
            dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rt<"row"<"col-sm-12 col-md-6"i><"col-sm-12 col-md-6"p>>',
            language: {
                search: "Search players:",
                lengthMenu: "Show _MENU_ entries",
                info: "Showing _START_ to _END_ of _TOTAL_ players",
                infoEmpty: "No players available",
                zeroRecords: "No matching players found"
            }
        });
        
        // Add click handler to player names
        $('#leagueTable tbody').on('click', 'td:first-child', (event) => {
            const playerName = $(event.target).text().trim();
            if (playerName && this.players.includes(playerName)) {
                this.selectPlayer(playerName);
                // Scroll to analysis section
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
        
        // Set up change handler
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
        
        // Calculate basic player stats
        const playerGames = this.gameLog.filter(game => 
            game['Player Name'] === playerName
        );
        
        const totalGames = playerGames.length;
        const wins = playerGames.filter(game => game.Result === 'Win').length;
        const draws = playerGames.filter(game => game.Result === 'Draw').length;
        const losses = playerGames.filter(game => game.Result === 'Loss').length;
        const goals = playerGames.reduce((sum, game) => sum + (parseInt(game.Goals) || 0), 0);
        const assists = playerGames.reduce((sum, game) => sum + (parseInt(game.Assists) || 0), 0);
        const ownGoals = playerGames.reduce((sum, game) => sum + (parseInt(game['Own Goals']) || 0), 0);
        
        const winPercent = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        const points = (wins * 3) + draws;
        const pointsPerGame = totalGames > 0 ? (points / totalGames).toFixed(1) : 0;
        
        // Update basic stats cards
        $('#totalGames').text(totalGames);
        $('#totalWins').text(wins);
        $('#totalDraws').text(draws);
        $('#totalLosses').text(losses);
        $('#winPercent').text(winPercent + '%');
        $('#pointsPerGame').text(pointsPerGame);
        $('#totalGoals').text(goals);
        $('#totalAssists').text(assists);
        $('#totalOwnGoals').text(ownGoals);
        
        // Show the stats section
        $('#playerStats').show();
        
        // Calculate and show partnership analysis
        this.showPartnershipAnalysis(playerName);
    }
    
    showPartnershipAnalysis(selectedPlayer) {
        const analysisData = [];
        
        // Analyze each other player
        this.players.forEach(otherPlayer => {
            if (otherPlayer === selectedPlayer) return;
            
            // Get games for both players
            const selectedGames = this.gameLog.filter(game => 
                game['Player Name'] === selectedPlayer
            );
            
            const otherGames = this.gameLog.filter(game => 
                game['Player Name'] === otherPlayer
            );
            
            // Find games in common
            let gamesInCommon = 0;
            let sameTeamGames = 0;
            let winTogether = 0;
            let oppositeTeamGames = 0;
            let selectedWinsVsOther = 0;
            
            // Create maps for quick lookup
            const selectedGameMap = {};
            selectedGames.forEach(game => {
                const key = game['Game ID'] + '|' + game.Team;
                selectedGameMap[key] = game;
            });
            
            const otherGameMap = {};
            otherGames.forEach(game => {
                const key = game['Game ID'] + '|' + game.Team;
                otherGameMap[key] = game;
            });
            
            // Find same team games
            Object.keys(selectedGameMap).forEach(key => {
                if (otherGameMap[key]) {
                    gamesInCommon++;
                    sameTeamGames++;
                    
                    if (selectedGameMap[key].Result === 'Win') {
                        winTogether++;
                    }
                }
            });
            
            // Find opposite team games
            selectedGames.forEach(sGame => {
                otherGames.forEach(oGame => {
                    if (sGame['Game ID'] === oGame['Game ID'] && 
                        sGame.Team !== oGame.Team) {
                        gamesInCommon++;
                        oppositeTeamGames++;
                        
                        if (sGame.Result === 'Win') {
                            selectedWinsVsOther++;
                        }
                    }
                });
            });
            
            // Only include players they've played with
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
        
        // Sort by games in common (descending), then by win percentage
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
            const winTogetherClass = data.winPercentTogether >= 60 ? 'table-success' :
                                   data.winPercentTogether <= 30 ? 'table-danger' : '';
            
            const h2hClass = data.h2hWinPercent >= 60 ? 'table-success' :
                           data.h2hWinPercent <= 30 && data.oppositeTeam > 0 ? 'table-danger' : '';
            
            const row = `
                <tr>
                    <td class="fw-bold">${data.player}</td>
                    <td>${data.gamesInCommon}</td>
                    <td>${data.sameTeam}</td>
                    <td>${data.oppositeTeam > 0 ? data.oppositeTeam : '-'}</td>
                    <td class="${winTogetherClass}">
                        ${data.sameTeam > 0 ? data.winPercentTogether + '%' : '-'}
                    </td>
                    <td class="${h2hClass}">
                        ${data.oppositeTeam > 0 ? data.h2hWinPercent + '%' : '-'}
                    </td>
                </tr>
            `;
            tableBody.append(row);
        });
    }
    
    updateLastUpdated() {
        // Try to get last modified date of GameLog.csv
        fetch('GameLog.csv', { method: 'HEAD' })
            .then(response => {
                const lastModified = response.headers.get('last-modified');
                if (lastModified) {
                    const date = new Date(lastModified);
                    const formatted = date.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    $('#lastUpdated').text(formatted);
                } else {
                    // Fallback to current date
                    const now = new Date();
                    const formatted = now.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });
                    $('#lastUpdated').text(formatted);
                }
            })
            .catch(() => {
                // If HEAD request fails, use current date
                const now = new Date();
                const formatted = now.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
                $('#lastUpdated').text(formatted);
            });
    }
    
    showLoading(show) {
        if (show) {
            $('#loadingIndicator').show();
            $('#leagueTable').closest('.stat-card').addClass('opacity-50');
        } else {
            $('#loadingIndicator').hide();
            $('#leagueTable').closest('.stat-card').removeClass('opacity-50');
        }
    }
    
    showError(message) {
        // Create error banner
        const errorHtml = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                <strong>Error:</strong> ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        // Insert at top
        $('.container').prepend(errorHtml);
    }
}

// Initialize the application when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Add loading indicator if not in HTML
    if ($('#loadingIndicator').length === 0) {
        $('nav').after(`
            <div id="loadingIndicator" class="container mt-3 text-center" style="display: none;">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading stats data...</p>
            </div>
        `);
    }
    
    // Initialize the app
    window.sidewindersApp = new SidewindersStats();
    
    // Add click handlers for navigation
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
    
    // Auto-select player from URL hash
    setTimeout(() => {
        const hash = window.location.hash;
        if (hash && hash.startsWith('#player-')) {
            const playerName = decodeURIComponent(hash.substring(8));
            if (playerName) {
                // Wait for app to load
                setTimeout(() => {
                    if (window.sidewindersApp && window.sidewindersApp.players.includes(playerName)) {
                        window.sidewindersApp.selectPlayer(playerName);
                        $('html, body').animate({
                            scrollTop: $('#analysis').offset().top - 20
                        }, 500);
                    }
                }, 1000);
            }
        }
    }, 500);
});

// Helper function to share player links
function sharePlayerAnalysis(playerName) {
    const url = new URL(window.location.href);
    url.hash = `#player-${encodeURIComponent(playerName)}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(url.toString())
        .then(() => {
            alert(`Link copied to clipboard! Share this to show ${playerName}'s stats.`);
        })
        .catch(err => {
            console.error('Failed to copy:', err);
        });
}

// Add share button handler if not in HTML
$(document).on('click', '.share-player', function() {
    const playerName = $(this).data('player');
    if (playerName) {
        sharePlayerAnalysis(playerName);
    }
});
