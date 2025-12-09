// Main application
class SidewindersStats {
    constructor() {
        this.gameLog = [];
        this.leagueTable = [];
        this.playerAnalysis = [];
        this.players = [];
        
        // Load data from embedded JSON
        this.loadData();
        
        // Initialize
        $(document).ready(() => {
            this.initLeagueTable();
            this.initPlayerSelector();
            this.setupEventListeners();
            this.updateLastUpdated();
        });
    }
    
    loadData() {
        try {
            // Get data from embedded JSON in the page
            const jsonElement = document.getElementById('dataContainer');
            let jsonText = jsonElement.textContent.trim();
            
            // If no embedded JSON, try to load from file
            if (!jsonText) {
                this.loadFromCSV();
                return;
            }
            
            const data = JSON.parse(jsonText);
            
            this.gameLog = this.parseCSV(data.GameLog || '');
            this.leagueTable = this.parseCSV(data['League Table'] || '');
            this.playerAnalysis = this.parseCSV(data['Player Analysis'] || '');
            
            // Extract unique players from game log
            this.players = [...new Set(this.gameLog.map(row => row['Player Name']))].sort();
            
        } catch (error) {
            console.error('Error loading data:', error);
            alert('Error loading data. Please check the data format.');
        }
    }
    
    parseCSV(csvText) {
        if (!csvText) return [];
        
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        
        return lines.slice(1).map(line => {
            const values = this.parseCSVLine(line);
            const row = {};
            headers.forEach((header, index) => {
                if (values[index] !== undefined) {
                    row[header] = values[index].replace(/"/g, '').trim();
                }
            });
            return row;
        });
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
    
    initLeagueTable() {
        const table = $('#leagueTable').DataTable({
            data: this.leagueTable,
            columns: [
                { data: 'Player' },
                { data: 'Appearances' },
                { data: 'Wins' },
                { data: 'Draws' },
                { data: 'Losses' },
                { data: 'Goals' },
                { data: 'Assists' },
                { 
                    data: 'Win Rate %',
                    render: function(data, type, row) {
                        if (type === 'sort') return parseFloat(data) || 0;
                        return data;
                    }
                },
                { 
                    data: 'Points Per Game',
                    render: function(data, type, row) {
                        if (type === 'sort') return parseFloat(data) || 0;
                        return data;
                    }
                }
            ],
            order: [[7, 'desc']], // Sort by Win Rate % descending
            pageLength: 25,
            responsive: true
        });
    }
    
    initPlayerSelector() {
        const select = $('#playerSelect');
        select.empty();
        select.append('<option value="">Choose a player...</option>');
        
        this.players.forEach(player => {
            select.append(`<option value="${player}">${player}</option>`);
        });
    }
    
    setupEventListeners() {
        $('#playerSelect').on('change', (e) => {
            const player = e.target.value;
            if (player) {
                this.showPlayerAnalysis(player);
            } else {
                $('#playerStats').hide();
            }
        });
    }
    
    showPlayerAnalysis(playerName) {
        // Show the stats section
        $('#playerStats').show();
        $('#playerName').text(playerName);
        
        // Calculate basic stats
        const playerGames = this.gameLog.filter(game => game['Player Name'] === playerName);
        const totalGames = playerGames.length;
        const wins = playerGames.filter(game => game.Result === 'Win').length;
        const goals = playerGames.reduce((sum, game) => sum + (parseInt(game.Goals) || 0), 0);
        const assists = playerGames.reduce((sum, game) => sum + (parseInt(game.Assists) || 0), 0);
        const winPercent = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        
        // Update basic stats
        $('#totalGames').text(totalGames);
        $('#winPercent').text(winPercent + '%');
        $('#totalGoals').text(goals);
        $('#totalAssists').text(assists);
        
        // Calculate partnership analysis
        this.showPartnershipAnalysis(playerName);
    }
    
    showPartnershipAnalysis(selectedPlayer) {
        const otherPlayers = this.players.filter(p => p !== selectedPlayer);
        const analysisData = [];
        
        otherPlayers.forEach(otherPlayer => {
            // Find games where both players participated
            const selectedGames = this.gameLog.filter(game => game['Player Name'] === selectedPlayer);
            const otherGames = this.gameLog.filter(game => game['Player Name'] === otherPlayer);
            
            // Create maps for quick lookup
            const selectedGameMap = {};
            selectedGames.forEach(game => {
                selectedGameMap[game['Game ID'] + '|' + game.Team] = game;
            });
            
            const otherGameMap = {};
            otherGames.forEach(game => {
                otherGameMap[game['Game ID'] + '|' + game.Team] = game;
            });
            
            // Find common games
            let sameTeam = 0;
            let oppositeTeam = 0;
            let winTogether = 0;
            let selectedWinsVsOther = 0;
            
            Object.keys(selectedGameMap).forEach(key => {
                if (otherGameMap[key]) {
                    sameTeam++;
                    if (selectedGameMap[key].Result === 'Win') {
                        winTogether++;
                    }
                }
            });
            
            // Find opposite team games
            selectedGames.forEach(sGame => {
                otherGames.forEach(oGame => {
                    if (sGame['Game ID'] === oGame['Game ID'] && sGame.Team !== oGame.Team) {
                        oppositeTeam++;
                        if (sGame.Result === 'Win') {
                            selectedWinsVsOther++;
                        }
                    }
                });
            });
            
            const gamesTogether = sameTeam + oppositeTeam;
            
            if (gamesTogether > 0) {
                const winPercentTogether = sameTeam > 0 ? Math.round((winTogether / sameTeam) * 100) : 0;
                const h2hWinPercent = oppositeTeam > 0 ? Math.round((selectedWinsVsOther / oppositeTeam) * 100) : 0;
                
                analysisData.push({
                    player: otherPlayer,
                    gamesTogether: gamesTogether,
                    sameTeam: sameTeam,
                    oppositeTeam: oppositeTeam,
                    winPercentTogether: winPercentTogether + '%',
                    h2hWinPercent: oppositeTeam > 0 ? h2hWinPercent + '%' : '-'
                });
            }
        });
        
        // Sort by games together (descending)
        analysisData.sort((a, b) => b.gamesTogether - a.gamesTogether);
        
        // Update table
        const tableBody = $('#partnershipTable tbody');
        tableBody.empty();
        
        analysisData.forEach(data => {
            const rowClass = data.winPercentTogether >= 60 ? 'win-high' : 
                            data.winPercentTogether <= 40 ? 'loss-high' : '';
            
            tableBody.append(`
                <tr class="${rowClass}">
                    <td>${data.player}</td>
                    <td>${data.gamesTogether}</td>
                    <td>${data.sameTeam}</td>
                    <td>${data.oppositeTeam}</td>
                    <td>${data.winPercentTogether}</td>
                    <td>${data.h2hWinPercent}</td>
                </tr>
            `);
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
    
    // Alternative: Load from CSV files directly
    async loadFromCSV() {
        try {
            const [gameLogData, leagueTableData] = await Promise.all([
                fetch('GameLog.csv').then(r => r.text()),
                fetch('LeagueTable.csv').then(r => r.text())
            ]);
            
            this.gameLog = this.parseCSV(gameLogData);
            this.leagueTable = this.parseCSV(leagueTableData);
            this.players = [...new Set(this.gameLog.map(row => row['Player Name']))].sort();
            
        } catch (error) {
            console.error('Error loading CSV files:', error);
        }
    }
}

// Initialize the application
const app = new SidewindersStats();
