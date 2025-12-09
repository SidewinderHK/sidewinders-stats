// Sidewinders Stats - Simplified working version
class SidewindersStats {
    constructor() {
        this.gameLog = [];
        this.leagueTable = [];
        this.players = [];
        this.selectedPlayer = null;
        
        // Initialize immediately
        this.init();
    }
    
    async init() {
        try {
            // Show loading
            $('#loadingIndicator').show();
            
            // Load data
            await this.loadAllData();
            this.calculateLeagueTable();
            
            // Initialize components
            this.initLeagueTable();
            this.initPlayerSelector();
            this.updateLastUpdated();
            
            // Hide loading
            $('#loadingIndicator').hide();
            
            console.log('App initialized successfully!');
            
        } catch (error) {
            console.error('Initialization error:', error);
            $('#loadingIndicator').hide();
            alert('Error loading data. Please check console for details.');
        }
    }
    
    async loadAllData() {
        try {
            // Load CSV file
            const response = await fetch('GameLog.csv');
            const csvText = await response.text();
            
            // Parse CSV
            this.gameLog = this.parseCSV(csvText);
            
            // Extract unique players
            const playerSet = new Set();
            this.gameLog.forEach(row => {
                if (row['Player']) {
                    playerSet.add(row['Player']);
                }
            });
            this.players = Array.from(playerSet).sort();
            
            console.log(`Loaded ${this.gameLog.length} game records`);
            console.log(`Found ${this.players.length} players`);
            
        } catch (error) {
            console.error('Error loading CSV:', error);
            throw error;
        }
    }
    
    parseCSV(csvText) {
        if (!csvText) return [];
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        // Parse headers
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        // Parse data rows
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            const row = {};
            
            headers.forEach((header, index) => {
                if (values[index] !== undefined) {
                    let value = values[index].replace(/"/g, '').trim();
                    
                    // Convert numeric columns
                    if (['Gls', 'OG', 'Ast', 'Pen'].includes(header)) {
                        value = parseInt(value) || 0;
                    }
                    
                    row[header] = value;
                }
            });
            
            if (Object.keys(row).length > 0) {
                data.push(row);
            }
        }
        
        return data;
    }
    
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current);
        return values;
    }
    
    calculateLeagueTable() {
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
        
        // Process game logs
        this.gameLog.forEach(game => {
            const player = game['Player'];
            if (!player || !playerStats[player]) return;
            
            const stats = playerStats[player];
            
            stats.Games++;
            
            // Points calculation
            if (game['Result'] === 'Win') {
                stats.Wins++;
                stats.TotalPoints += 3;
            } else if (game['Result'] === 'Draw') {
                stats.Draws++;
                stats.TotalPoints += 1;
            } else if (game['Result'] === 'Loss') {
                stats.Losses++;
            }
            
            // Stats
            stats.Goals += game['Gls'] || 0;
            stats.OwnGoals += game['OG'] || 0;
            stats.Assists += game['Ast'] || 0;
            stats.Penalties += game['Pen'] || 0;
        });
        
        // Calculate PPG and Win Percent
        Object.values(playerStats).forEach(stats => {
            if (stats.Games > 0) {
                stats.PPG = (stats.TotalPoints / stats.Games).toFixed(1);
                stats.WinPercent = ((stats.Wins / stats.Games) * 100).toFixed(1);
            }
        });
        
        // Sort by Total Points, then PPG, then Win Percent
        this.leagueTable = Object.values(playerStats).sort((a, b) => {
            if (b.TotalPoints !== a.TotalPoints) return b.TotalPoints - a.TotalPoints;
            if (parseFloat(b.PPG) !== parseFloat(a.PPG)) return parseFloat(b.PPG) - parseFloat(a.PPG);
            return parseFloat(b.WinPercent) - parseFloat(a.WinPercent);
        });
    }
    
    initLeagueTable() {
        // Clear existing table
        $('#leagueTable').empty();
        
        // Create table structure
        const table = $('<table>').addClass('table table-hover table-striped').attr('id', 'leagueTable').css('width', '100%');
        const thead = $('<thead>').addClass('table-dark');
        const tbody = $('<tbody>');
        
        // Create header
        const headerRow = $('<tr>');
        [
            'Player', 'Games', 'Wins', 'Draws', 'Losses', 
            'Goals', 'Own Goals', 'Assists', 'Penalties', 
            'Total Points', 'PPG', 'Win %'
        ].forEach(text => {
            const th = $('<th>').text(text);
            if (text !== 'Player') th.addClass('text-center');
            headerRow.append(th);
        });
        thead.append(headerRow);
        
        // Create rows
        this.leagueTable.forEach(player => {
            const row = $('<tr>');
            
            // Player name (clickable)
            const playerCell = $('<td>').addClass('fw-bold clickable-player').text(player.Player);
            playerCell.click(() => this.selectPlayer(player.Player));
            row.append(playerCell);
            
            // Basic stats
            [
                player.Games, player.Wins, player.Draws, player.Losses,
                player.Goals, player.OwnGoals, player.Assists, player.Penalties
            ].forEach(value => {
                const td = $('<td>').addClass('text-center').text(value);
                if (value === player.Goals) td.addClass('text-primary fw-bold');
                row.append(td);
            });
            
            // Total Points
            const pointsCell = $('<td>').addClass('text-center text-success fw-bold')
                .html(`<span class="points-badge">${player.TotalPoints}</span>`);
            row.append(pointsCell);
            
            // PPG
            const ppgCell = $('<td>').addClass('text-center fw-bold')
                .html(`<span class="ppg-value">${player.PPG}</span>`);
            row.append(ppgCell);
            
            // Win %
            const winPercent = parseFloat(player.WinPercent);
            let winColor = '#dc3545';
            if (winPercent >= 60) winColor = '#198754';
            else if (winPercent >= 40) winColor = '#fd7e14';
            
            const winCell = $('<td>').addClass('text-center')
                .html(`<span style="color: ${winColor}; font-weight: bold">${player.WinPercent}%</span>`);
            row.append(winCell);
            
            tbody.append(row);
        });
        
        // Assemble table
        table.append(thead).append(tbody);
        
        // Replace existing table
        $('#leagueTable').replaceWith(table);
        
        // Add horizontal scroll wrapper for mobile
        $('table#leagueTable').wrap('<div class="table-responsive"></div>');
    }
    
    initPlayerSelector() {
        const select = $('#playerSelect');
        select.empty();
        select.append('<option value="">Choose a player...</option>');
        
        this.players.forEach(player => {
            select.append(`<option value="${player}">${player}</option>`);
        });
        
        select.change((e) => {
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
        // Show section
        $('#playerStats').show();
        $('#playerName').text(playerName);
        
        // Find player stats
        const playerStats = this.leagueTable.find(p => p.Player === playerName);
        if (!playerStats) return;
        
        // Update basic stats
        $('#totalGames').text(playerStats.Games);
        $('#totalWins').text(playerStats.Wins);
        $('#totalDraws').text(playerStats.Draws);
        $('#totalLosses').text(playerStats.Losses);
        $('#totalPoints').text(playerStats.TotalPoints);
        $('#totalGoals').text(playerStats.Goals);
        $('#totalAssists').text(playerStats.Assists);
        $('#totalOwnGoals').text(playerStats.OwnGoals);
        $('#totalPenalties').text(playerStats.Penalties);
        
        // Calculate goal contributions
        const goalContributions = playerStats.Goals + playerStats.Assists;
        $('#goalContributions').text(goalContributions);
        
        // Win percentage
        $('#winPercent').text(playerStats.WinPercent + '%');
        $('#winPercentBar').css('width', playerStats.WinPercent + '%');
        
        // Enable share button
        $('#shareButton').prop('disabled', false);
        
        // Show partnership analysis
        this.showPartnershipAnalysis(playerName);
    }
    
    showPartnershipAnalysis(selectedPlayer) {
        const analysisData = [];
        
        this.players.forEach(otherPlayer => {
            if (otherPlayer === selectedPlayer) return;
            
            const selectedGames = this.gameLog.filter(g => g['Player'] === selectedPlayer);
            const otherGames = this.gameLog.filter(g => g['Player'] === otherPlayer);
            
            let gamesInCommon = 0;
            let sameTeamGames = 0;
            let winTogether = 0;
            let oppositeTeamGames = 0;
            let selectedWinsVsOther = 0;
            
            // Find games together
            selectedGames.forEach(sGame => {
                otherGames.forEach(oGame => {
                    if (sGame['ID'] === oGame['ID']) {
                        gamesInCommon++;
                        
                        if (sGame['Team'] === oGame['Team']) {
                            sameTeamGames++;
                            if (sGame['Result'] === 'Win') winTogether++;
                        } else {
                            oppositeTeamGames++;
                            if (sGame['Result'] === 'Win') selectedWinsVsOther++;
                        }
                    }
                });
            });
            
            if (gamesInCommon > 0) {
                analysisData.push({
                    player: otherPlayer,
                    gamesInCommon: gamesInCommon,
                    sameTeam: sameTeamGames,
                    oppositeTeam: oppositeTeamGames,
                    winPercentTogether: sameTeamGames > 0 ? 
                        Math.round((winTogether / sameTeamGames) * 100) : 0,
                    h2hWinPercent: oppositeTeamGames > 0 ? 
                        Math.round((selectedWinsVsOther / oppositeTeamGames) * 100) : 0
                });
            }
        });
        
        // Sort by games in common
        analysisData.sort((a, b) => b.gamesInCommon - a.gamesInCommon);
        
        // Update table
        const tbody = $('#partnershipTable tbody');
        tbody.empty();
        
        if (analysisData.length === 0) {
            tbody.append('<tr><td colspan="6" class="text-center text-muted">No partnership data</td></tr>');
            return;
        }
        
        analysisData.forEach(data => {
            const row = $('<tr>');
            
            // Player name (clickable)
            const playerCell = $('<td>').addClass('fw-bold clickable-player').text(data.player);
            playerCell.click(() => this.selectPlayer(data.player));
            row.append(playerCell);
            
            // Stats
            [
                data.gamesInCommon,
                data.sameTeam,
                data.oppositeTeam > 0 ? data.oppositeTeam : '-',
                data.sameTeam > 0 ? data.winPercentTogether + '%' : '-',
                data.oppositeTeam > 0 ? data.h2hWinPercent + '%' : '-'
            ].forEach((value, index) => {
                const td = $('<td>').addClass('text-center').text(value);
                if (index === 3 && data.winPercentTogether >= 60) td.addClass('table-success-light');
                if (index === 4 && data.h2hWinPercent >= 60) td.addClass('table-success-light');
                row.append(td);
            });
            
            tbody.append(row);
        });
    }
    
    updateLastUpdated() {
        const now = new Date();
        const formatted = now.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        $('#lastUpdated').text(formatted);
    }
}

// Initialize app when page loads
$(document).ready(function() {
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

// Share function
function shareCurrentPlayer() {
    const playerName = $('#playerSelect').val();
    if (!playerName) return;
    
    const url = new URL(window.location.href);
    url.hash = `player-${encodeURIComponent(playerName)}`;
    
    navigator.clipboard.writeText(url.toString())
        .then(() => {
            alert(`Link to ${playerName}'s analysis copied to clipboard!`);
        })
        .catch(() => {
            prompt('Copy this URL:', url.toString());
        });
}
