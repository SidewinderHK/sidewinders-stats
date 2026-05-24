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
    } catch (error) {
        console.error('Initialization error:', error);
        this.showError('Failed to load data. Please check GameLog.csv file.');
    } finally {
        // This line guarantees the spinning wheel disappears no matter what!
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
            
            const result = game['Result'] ? game['Result'].trim() : '';
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
        
        if (char === '"') {
            // Handle escaped quotes inside a quoted string safely
            if (insideQuotes && i + 1 < line.length && line[i + 1] === '"') {
                currentValue += '"';
                i++; // Safe advance
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
    
    // Push the final field remaining on the line
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
        
        const columns = [
            { 
                data: 'Player',
                className: 'fw-bold clickable-player',
                render: function(data, type, row) {
                    return `<span class="clickable-player">${data}</span>`;
                },
                type: 'string'
            },
            { data: 'Games', className: 'text-center', title: 'Games', type: 'num' },
            { data: 'Wins', className: 'text-center', title: 'Wins', type: 'num' },
            { data: 'Draws', className: 'text-center', title: 'Draws', type: 'num' },
            { data: 'Losses', className: 'text-center', title: 'Losses', type: 'num' },
            { 
                data: 'Goals',
                className: 'text-center fw-bold text-primary',
                title: 'Goals',
                type: 'num',
                render: function(data, type, row) {
                    if (type === 'sort' || type === 'type') return data;
                    return `<span class="goals-highlight">${data}</span>`;
                }
            },
            { data: 'OwnGoals', className: 'text-center', title: 'Own Goals', type: 'num' },
            { data: 'Assists', className: 'text-center', title: 'Assists', type: 'num' },
            { data: 'Penalties', className: 'text-center', title: 'Penalties', type: 'num' },
            { 
                data: 'TotalPoints',
                className: 'text-center fw-bold text-success',
                title: 'Total Points',
                type: 'num',
                render: function(data, type, row) {
                    if (type === 'sort' || type === 'type') return data;
                    return `<strong class="points-badge">${data}</strong>`;
                }
            },
            { 
                data: 'PPG',
                className: 'text-center fw-bold',
                title: 'PPG',
                type: 'num',
                render: function(data, type, row) {
                    if (type === 'sort' || type === 'type') return data;
                    return `<span class="ppg-value" title="Points Per Game">${data.toFixed(1)}</span>`;
                }
            },
            { 
                data: 'WinPercent',
                className: 'text-center',
                title: 'Win %',
                type: 'num',
                render: function(data, type, row) {
                    if (type === 'sort' || type === 'type') return data;
                    let color = '#dc3545';
                    if (data >= 60) color = '#198754';
                    else if (data >= 40) color = '#fd7e14';
                    return `<span style="color: ${color}; font-weight: bold">${data}%</span>`;
                }
            }
        ];

        const table = $('#leagueTable').DataTable({
            data: this.leagueTable,
            columns: columns,
            order: [[9, 'desc']], 
            pageLength: 25,
            responsive: true,
            stateSave: true,
            stateDuration: 60 * 60 * 24 * 7,
            language: {
                search: "Search players:",
                lengthMenu: "Show _MENU_ entries",
                info: "Showing _START_ to _END_ of _TOTAL_ players",
                infoEmpty: "No players to show",
                infoFiltered: "(filtered from _MAX_ total players)",
                emptyTable: "No game data available",
                zeroRecords: "No matching players found",
                paginate: { first: "First", last: "Last", next: "Next", previous: "Previous" }
            },
            initComplete: function() {
                const api = this.api();
                api.on('draw.dt', function() {
                    const order = api.order();
                    if (order.length > 0) {
                        const colIndex = order[0][0];
                        const dir = order[0][1];
                        
                        api.columns().every(function() {
                            $(this.header()).find('.sort-indicator i').removeClass('fa-sort-up fa-sort-down').addClass('fa-sort');
                        });
                        
                        const header = $(api.column(colIndex).header());
                        const indicator = header.find('.sort-indicator i');
                        indicator.removeClass('fa-sort').addClass(dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down');

                        $('.sort-btn').removeClass('active');
                        if (colIndex === 9 && dir === 'desc') $('.sort-btn[data-sort="9"]').addClass('active');
                        else if (colIndex === 10 && dir === 'desc') $('.sort-btn[data-sort="10"]').addClass('active');
                        else if (colIndex === 11 && dir === 'desc') $('.sort-btn[data-sort="11"]').addClass('active');
                        else if (colIndex === 1 && dir === 'desc') $('.sort-btn[data-sort="1"]').addClass('active');
                        else if (colIndex === 5 && dir === 'desc') $('.sort-btn[data-sort="5"]').addClass('active');
                        else if (colIndex === 0 && dir === 'asc') $('.sort-btn[data-sort="0"]').addClass('active');
                    }
                });

                const order = api.order();
                if (order.length > 0) {
                    const colIndex = order[0][0];
                    const dir = order[0][1];
                    const header = $(api.column(colIndex).header());
                    const indicator = header.find('.sort-indicator i');
                    indicator.removeClass('fa-sort').addClass(dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
                }
            }
        });

        $('#leagueTable tbody').on('click', 'td.clickable-player', (e) => {
            const playerName = $(e.currentTarget).text().trim();
            this.selectPlayer(playerName);
        });
    }
    
    sortByColumn(columnIndex, order) {
        const table = $('#leagueTable').DataTable();
        const button = $(`.sort-btn[data-sort="${columnIndex}"]`);
        
        $('.sort-btn').removeClass('active');
        button.addClass('active');
        table.order([columnIndex, order]).draw();
        
        const api = table;
        api.columns().every(function() {
            $(this.header()).find('.sort-indicator i').removeClass('fa-sort-up fa-sort-down').addClass('fa-sort');
        });
        const header = $(api.column(columnIndex).header());
        const indicator = header.find('.sort-indicator i');
        indicator.removeClass('fa-sort').addClass(order === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
    }
    
    resetSorting() {
        const table = $('#leagueTable').DataTable();
        table.order([[9, 'desc']]).draw();
        $('.sort-btn').removeClass('active');
        $('.sort-btn[data-sort="9"]').addClass('active');
    }
    
    initPlayerSelector() {
        const select = $('#playerSelect');
        select.empty();
        select.append('<option value="">Choose a player...</option>');
        this.players.forEach(player => {
            select.append(`<option value="${player}">${player}</option>`);
        });
        
        select.change((e) => {
            const selected = $(e.target).value || select.val();
            if (selected) this.showPlayerAnalysis(selected);
        });
    }
    
    selectPlayer(playerName) {
        $('#playerSelect').val(playerName);
        this.showPlayerAnalysis(playerName);
        
        $('html, body').animate({
            scrollTop: $('#analysis').offset().top - 20
        }, 500);
    }
    
    showPlayerAnalysis(playerName) {
        console.log(`Showing analysis for player: ${playerName}`);
        this.selectedPlayer = playerName;
        $('#playerName').text(playerName);
        
        const playerStats = this.leagueTable.find(row => row.Player === playerName);
        
        if (playerStats) {
            $('#totalGames').text(playerStats.Games);
            $('#totalWins').text(playerStats.Wins);
            $('#totalDraws').text(playerStats.Draws);
            $('#totalLosses').text(playerStats.Losses);
            $('#totalPoints').text(playerStats.TotalPoints);
            $('#totalGoals').text(playerStats.Goals);
            $('#totalAssists').text(playerStats.Ass
