/**
 * Sidewinders Football App
 * Application logic for parsing CSV season logs, building statistics,
 * and presenting interactive DataTables.
 */

class SidewindersApp {
    constructor() {
        this.MIN_GAMES_THRESHOLD = 5;
        this.extendedColumnsIndices = [6, 7, 8, 10, 11, 12, 13];
        this.currentSeason = 'current';
        this.dataTable = null;
        this.gameLog = [];
        this.leagueTable = [];
        this.players = [];

        this.seasons = {
            current: { 
                name: "Current Season", 
                type: "full", 
                file: "GameLog.csv", 
                hasAnalysis: true, 
                label: "Current Season",
                heading: "Current Season"
            },
            archive2526: { 
                name: "2025/26 Season", 
                type: "full", 
                file: "GameLog25.csv", 
                hasAnalysis: true, 
                label: "2025/26 Season",
                heading: "2025/26 Season"
            },
            summer25: { 
                name: "Summer 2025", 
                type: "summary", 
                file: "Summer25.csv", 
                hasAnalysis: false, 
                label: "Summer 2025",
                heading: "Summer 2025"
            },
            season2425: { 
                name: "2024/25 Season", 
                type: "summary", 
                file: "Season24.csv", 
                hasAnalysis: false, 
                label: "2024/25 Season",
                heading: "2024/25 Season"
            },
            season2324: { 
                name: "2023/24 Season", 
                type: "summary", 
                file: "Season23.csv", 
                hasAnalysis: false, 
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
            // Setup controls and listeners before loading season
            this.setupEventListeners();
            this.setupExtendedStatsToggle();

            // Load initial current season
            await this.loadSeason("current");
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to load season data. Please verify CSV files.');
            this.showLoading(false);
        }
    }

    setupEventListeners() {
        // Season dropdown selector
        $('#seasonList .dropdown-item').off('click').on('click', (e) => {
            e.preventDefault();
            const seasonId = $(e.currentTarget).data('season');
            if (seasonId && this.seasons[seasonId] && seasonId !== this.currentSeason) {
                this.loadSeason(seasonId);
            }
        });

        // Min games filter toggle
        $('#filterMinGames').off('change').on('change', () => {
            this.refreshLeagueTable();
        });

        // Manual recalculate/refresh button
        $('#recalcBtn').off('click').on('click', () => {
            if (this.currentSeason && this.seasons[this.currentSeason].type === 'full') {
                this.calculateLeagueTable();
            }
            this.refreshLeagueTable();
        });

        // Reset sort button
        $('#resetSortBtn').off('click').on('click', () => {
            this.resetSorting();
        });

        // Share player link button
        $('#shareButton').off('click').on('click', () => {
            this.shareCurrentPlayer();
        });

        // Player selection dropdown
        $('#playerSelect').off('change').on('change', (e) => {
            const selectedPlayer = $(e.target).value || $(e.target).val();
            if (selectedPlayer) {
                this.selectPlayer(selectedPlayer);
            } else {
                $('#playerStats').addClass('d-none');
                $('#shareButton').prop('disabled', true);
            }
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
            for (let colIdx of this.extendedColumnsIndices) {
                this.dataTable.column(colIdx).visible(show, false);
            }
            this.dataTable.columns.adjust().draw(false);
        }
    }

    async loadSeason(seasonId) {
        this.currentSeason = seasonId;
        const season = this.seasons[seasonId];

        // Update dropdown button label & section heading
        $('#currentSeasonLabel').text(season.label);
        $('#seasonHeading').text(season.heading);
        $('#errorMessage').addClass('d-none');

        this.showLoading(true);

        try {
            if (season.type === 'full') {
                await this.loadFullSeason(season.file);
                this.calculateLeagueTable();
                this.initPlayerSelector();
                $('#playerStats').addClass('d-none');
                $('#shareButton').prop('disabled', true);
                $('#analysis').show();
                $('#analysisNavLink').show();
            } else {
                await this.loadSummarySeason(season.file);
                $('#playerStats').addClass('d-none');
                $('#shareButton').prop('disabled', true);
                $('#analysis').hide();
                $('#analysisNavLink').hide();
            }

            // Unhide container BEFORE initializing DataTables so layout metrics calculate correctly
            this.showLoading(false);
            this.initLeagueTable();
            this.updateLastUpdated(season.file);

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
            const goals = parseInt(values[headers.indexOf('Gls')]) || 0;
            const ownGoals = parseInt(values[headers.indexOf('OG')]) || 0;
            const assists = parseInt(values[headers.indexOf('Ast')]) || 0;
            let points = parseInt(values[headers.indexOf('Pts')]) || 0;
            
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

        this.leagueTable = Object.values(playerStats).filter(p => p.Games > 0);
    }

    initLeagueTable() {
        if (this.dataTable) {
            this.dataTable.destroy();
            this.dataTable = null;
        }

        let shouldFilter = $('#filterMinGames').is(':checked');
        let runningDataset = shouldFilter 
            ? this.leagueTable.filter(p => Number(p.Games) >= this.MIN_GAMES_THRESHOLD)
            : [...this.leagueTable];

        // Fallback fix: If min games filter is checked but returns empty (e.g. early season), uncheck filter & show all
        if (shouldFilter && runningDataset.length === 0 && this.leagueTable.length > 0) {
            $('#filterMinGames').prop('checked', false);
            shouldFilter = false;
            runningDataset = [...this.leagueTable];
        }

        this.updateFilterBadge(shouldFilter, runningDataset.length, this.leagueTable.length);

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
            { data: 'GPG', className: 'text-center', render: data => `<span>${Number(data).toFixed(2)}</span>` },
            { data: 'APG', className: 'text-center', render: data => `<span>${Number(data).toFixed(2)}</span>` },
            { data: 'PPG', className: 'text-center', render: data => `<span>${Number(data).toFixed(2)}</span>` },
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
            order: [[9, 'desc']], // Default sort by Points descending
            pageLength: 25,
            responsive: true,
            stateSave: false,
            destroy: true
        });

        // Set column visibility based on current toggle state
        const extendedOn = $('#extendedStatsToggle').is(':checked');
        this.setExtendedStatsVisibility(extendedOn);

        // Click player name to jump to player analysis
        if (this.seasons[this.currentSeason].hasAnalysis) {
            $('#leagueTable tbody').off('click', 'span.clickable-player').on('click', 'span.clickable-player', (event) => {
                const playerName = $(event.target).text().trim();
                if (playerName && this.players.includes(playerName)) {
                    this.selectPlayer(playerName);
                    $('html, body').animate({ scrollTop: $('#analysis').offset().top - 20 }, 500);
                }
            });
        }

        // Guarantee DataTables adjusts layout when initialized
        setTimeout(() => {
            if (this.dataTable) {
                this.dataTable.columns.adjust().draw(false);
            }
        }, 50);
    }

    refreshLeagueTable() {
        if (!this.dataTable) {
            this.initLeagueTable();
            return;
        }

        let shouldFilter = $('#filterMinGames').is(':checked');
        let newData = shouldFilter 
            ? this.leagueTable.filter(p => Number(p.Games) >= this.MIN_GAMES_THRESHOLD)
            : [...this.leagueTable];

        if (shouldFilter && newData.length === 0 && this.leagueTable.length > 0) {
            $('#filterMinGames').prop('checked', false);
            shouldFilter = false;
            newData = [...this.leagueTable];
        }

        this.dataTable.clear();
        this.dataTable.rows.add(newData);
        this.dataTable.draw();

        this.updateFilterBadge(shouldFilter, newData.length, this.leagueTable.length);
    }

    updateFilterBadge(isFiltered, shown, total) {
        $('#filterStatus').remove();
        if (isFiltered) {
            const badgeHtml = `<span id="filterStatus" class="badge bg-info ms-2">Filtered: ${shown}/${total} (min ${this.MIN_GAMES_THRESHOLD} games)</span>`;
            $('#leagueTableSection .d-flex.justify-content-between').append(badgeHtml);
        }
    }

    resetSorting() {
        if (this.dataTable) {
            this.dataTable.order([[9, 'desc']]).draw();
        }
    }

    initPlayerSelector() {
        const select = $('#playerSelect');
        select.empty().append('<option value="">-- Choose a player --</option>');
        this.players.forEach(player => {
            select.append(`<option value="${player}">${player}</option>`);
        });
    }

    selectPlayer(playerName) {
        $('#playerSelect').val(playerName);
        const stats = this.leagueTable.find(p => p.Player === playerName);
        if (!stats) return;

        $('#statGames').text(stats.Games);
        $('#statWinRate').text(`${stats.WinPercent}%`);
        $('#statGoals').text(stats.Goals);
        $('#statAssists').text(stats.Assists);

        // Populate recent game log for player
        const playerGames = this.gameLog.filter(g => g.Player === playerName);
        const tbody = $('#playerGameLogBody').empty();

        if (playerGames.length > 0) {
            playerGames.forEach(g => {
                const badgeColor = g.Result === 'Win' ? 'bg-success' : (g.Result === 'Draw' ? 'bg-warning text-dark' : 'bg-danger');
                tbody.append(`
                    <tr>
                        <td>${g.ID || '-'}</td>
                        <td>${g.Date || '-'}</td>
                        <td>${g.Team || '-'}</td>
                        <td><span class="badge ${badgeColor}">${g.Result || '-'}</span></td>
                        <td class="text-center">${g.Gls || 0}</td>
                        <td class="text-center">${g.Ast || 0}</td>
                        <td class="text-center">${g.OG || 0}</td>
                    </tr>
                `);
            });
        } else {
            tbody.append(`<tr><td colspan="7" class="text-center text-muted">No game records found.</td></tr>`);
        }

        $('#playerStats').removeClass('d-none');
        $('#shareButton').prop('disabled', false);
    }

    shareCurrentPlayer() {
        const player = $('#playerSelect').val();
        if (!player) return;

        const shareUrl = `${window.location.origin}${window.location.pathname}#player-${encodeURIComponent(player)}`;
        navigator.clipboard.writeText(shareUrl).then(() => {
            alert(`Link copied to clipboard!\n${shareUrl}`);
        }).catch(() => {
            prompt("Copy this link:", shareUrl);
        });
    }

    updateLastUpdated(filename) {
        const now = new Date();
        const timeString = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        $('#lastUpdated').html(`<i class="fas fa-check-circle me-1"></i> File: ${filename} (Loaded: ${timeString})`);
    }

    showLoading(show) {
        if (show) {
            $('#loadingSpinner').removeClass('d-none');
            $('#leagueTableContainer').addClass('d-none');
        } else {
            $('#loadingSpinner').addClass('d-none');
            $('#leagueTableContainer').removeClass('d-none');
        }
    }

    showError(message) {
        $('#errorText').text(message);
        $('#errorMessage').removeClass('d-none');
    }
}

// Instantiate App
new SidewindersApp();