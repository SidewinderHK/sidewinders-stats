// Pre-Match Analysis Tool - Optimized for Large Player Pool
class PreMatchAnalyzer {
    constructor(gameLog, leagueTable) {
        this.gameLog = gameLog;
        this.leagueTable = leagueTable; // Use existing league table data!
        this.playerStats = {};
        this.playerPairs = {}; // Track player synergies
        this.init();
    }
    
    init() {
        console.log("Initializing pre-match analyzer with", this.gameLog.length, "games");
        this.calculatePlayerStats();
        this.calculatePlayerSynergies();
    }
    
    calculatePlayerStats() {
        console.log("Calculating player statistics...");
        
        // First, load existing league table data for reliable base stats
        if (this.leagueTable && this.leagueTable.length > 0) {
            this.leagueTable.forEach(player => {
                this.playerStats[player.Player] = {
                    name: player.Player,
                    games: player.Games,
                    wins: player.Wins,
                    draws: player.Draws,
                    losses: player.Losses,
                    goals: player.Goals,
                    assists: player.Assists,
                    ownGoals: player.OwnGoals,
                    points: player.TotalPoints,
                    ppg: player.PPG,
                    winPercent: player.WinPercent,
                    goalsPerGame: player.Games > 0 ? player.Goals / player.Games : 0,
                    assistsPerGame: player.Games > 0 ? player.Assists / player.Games : 0,
                    goalContribution: player.Goals + player.Assists,
                    goalContributionPerGame: player.Games > 0 ? (player.Goals + player.Assists) / player.Games : 0,
                    last5Games: [],
                    reliability: Math.min(1, player.Games / 20) // Cap at 20 games for reliability
                };
            });
        }
        
        // Supplement with detailed game-by-game data for form and synergies
        this.gameLog.forEach(game => {
            const player = game['Player'];
            if (!player) return;
            
            if (!this.playerStats[player]) {
                this.playerStats[player] = {
                    name: player,
                    games: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goals: 0,
                    assists: 0,
                    ownGoals: 0,
                    points: 0,
                    ppg: 0,
                    winPercent: 0,
                    goalsPerGame: 0,
                    assistsPerGame: 0,
                    goalContribution: 0,
                    goalContributionPerGame: 0,
                    last5Games: [],
                    reliability: 0
                };
            }
            
            const stats = this.playerStats[player];
            
            // Track last 5 games for form (regardless of existing data)
            if (stats.last5Games.length >= 5) {
                stats.last5Games.shift();
            }
            
            const result = game['Result'];
            let points = 0;
            if (result === 'Win') points = 3;
            else if (result === 'Draw') points = 1;
            
            stats.last5Games.push({
                result: result,
                points: points,
                goals: parseInt(game['Gls']) || 0,
                assists: parseInt(game['Ast']) || 0,
                date: game['Date']
            });
        });
        
        // Calculate form ratings
        Object.values(this.playerStats).forEach(stats => {
            if (stats.last5Games.length > 0) {
                const formPoints = stats.last5Games.reduce((sum, g) => sum + g.points, 0);
                const maxPoints = stats.last5Games.length * 3;
                stats.formRating = (formPoints / maxPoints * 100).toFixed(1);
                stats.formGoals = stats.last5Games.reduce((sum, g) => sum + g.goals, 0);
                stats.formAssists = stats.last5Games.reduce((sum, g) => sum + g.assists, 0);
            } else {
                stats.formRating = 50; // Neutral if no recent games
                stats.formGoals = 0;
                stats.formAssists = 0;
            }
            
            // Calculate weighted reliability score
            stats.reliability = Math.min(1, (stats.games / 30) * 0.7 + (stats.last5Games.length / 5) * 0.3);
        });
    }
    
    calculatePlayerSynergies() {
        console.log("Calculating player synergies...");
        
        // Track how players perform when playing together
        const gameTeams = {};
        
        this.gameLog.forEach(game => {
            const gameId = game['ID'];
            const player = game['Player'];
            const team = game['Team'];
            const result = game['Result'];
            
            if (!gameTeams[gameId]) {
                gameTeams[gameId] = {
                    teams: {},
                    result: null
                };
            }
            
            if (!gameTeams[gameId].teams[team]) {
                gameTeams[gameId].teams[team] = {
                    players: [],
                    result: result
                };
            }
            
            gameTeams[gameId].teams[team].players.push(player);
        });
        
        // Analyze each game's team compositions
        Object.values(gameTeams).forEach(game => {
            const teams = Object.values(game.teams);
            if (teams.length === 2) {
                const team1Players = teams[0].players;
                const team2Players = teams[1].players;
                const team1Result = teams[0].result;
                const team2Result = teams[1].result;
                
                // Track pairs within winning team
                const winningTeam = team1Result === 'Win' ? team1Players : 
                                   (team2Result === 'Win' ? team2Players : null);
                
                if (winningTeam) {
                    // Record synergy for all pairs in winning team
                    for (let i = 0; i < winningTeam.length; i++) {
                        for (let j = i + 1; j < winningTeam.length; j++) {
                            const pairKey = [winningTeam[i], winningTeam[j]].sort().join('|');
                            if (!this.playerPairs[pairKey]) {
                                this.playerPairs[pairKey] = {
                                    player1: winningTeam[i],
                                    player2: winningTeam[j],
                                    gamesTogether: 0,
                                    winsTogether: 0
                                };
                            }
                            this.playerPairs[pairKey].gamesTogether++;
                            this.playerPairs[pairKey].winsTogether++;
                        }
                    }
                }
                
                // Also track losses for negative synergy
                const losingTeam = team1Result === 'Loss' ? team1Players : 
                                  (team2Result === 'Loss' ? team2Players : null);
                
                if (losingTeam) {
                    for (let i = 0; i < losingTeam.length; i++) {
                        for (let j = i + 1; j < losingTeam.length; j++) {
                            const pairKey = [losingTeam[i], losingTeam[j]].sort().join('|');
                            if (!this.playerPairs[pairKey]) {
                                this.playerPairs[pairKey] = {
                                    player1: losingTeam[i],
                                    player2: losingTeam[j],
                                    gamesTogether: 0,
                                    winsTogether: 0
                                };
                            }
                            this.playerPairs[pairKey].gamesTogether++;
                            // Don't increment wins for losses
                        }
                    }
                }
            }
        });
        
        // Calculate synergy scores
        Object.values(this.playerPairs).forEach(pair => {
            pair.winRate = pair.gamesTogether > 0 ? 
                (pair.winsTogether / pair.gamesTogether * 100).toFixed(1) : 0;
            pair.synergyScore = pair.gamesTogether > 0 ?
                ((pair.winsTogether / pair.gamesTogether - 0.5) * 2).toFixed(2) : 0;
        });
    }
    
    analyzeTeams(team1Players, team2Players) {
        console.log("Analyzing matchup with", team1Players.length, "vs", team2Players.length, "players");
        
        // Filter out players with no stats (but still include with default values)
        const team1Stats = team1Players.map(p => this.playerStats[p] || this.createDefaultStats(p));
        const team2Stats = team2Players.map(p => this.playerStats[p] || this.createDefaultStats(p));
        
        // Calculate weighted team metrics (more reliable players have higher weight)
        const team1Weight = team1Stats.reduce((sum, s) => sum + s.reliability, 0);
        const team2Weight = team2Stats.reduce((sum, s) => sum + s.reliability, 0);
        
        const team1Metrics = this.calculateWeightedMetrics(team1Stats);
        const team2Metrics = this.calculateWeightedMetrics(team2Stats);
        
        // Calculate synergy within teams
        const team1Synergy = this.calculateTeamSynergy(team1Players);
        const team2Synergy = this.calculateTeamSynergy(team2Players);
        
        // Calculate head-to-head history between these specific players
        const h2hStats = this.calculateHeadToHead(team1Players, team2Players);
        
        // Calculate prediction using weighted factors
        const prediction = this.calculatePrediction(
            team1Metrics, team2Metrics, 
            team1Synergy, team2Synergy, 
            h2hStats,
            team1Weight, team2Weight
        );
        
        // Generate insights
        const insights = this.generateInsights(
            team1Stats, team2Stats, 
            team1Synergy, team2Synergy,
            h2hStats
        );
        
        return {
            team1: {
                name: "Team 1",
                players: team1Players,
                stats: team1Stats,
                metrics: team1Metrics,
                synergy: team1Synergy,
                totalGames: team1Stats.reduce((sum, s) => sum + s.games, 0),
                totalGoals: team1Stats.reduce((sum, s) => sum + s.goals, 0),
                avgReliability: (team1Weight / team1Stats.length * 100).toFixed(1)
            },
            team2: {
                name: "Team 2",
                players: team2Players,
                stats: team2Stats,
                metrics: team2Metrics,
                synergy: team2Synergy,
                totalGames: team2Stats.reduce((sum, s) => sum + s.games, 0),
                totalGoals: team2Stats.reduce((sum, s) => sum + s.goals, 0),
                avgReliability: (team2Weight / team2Stats.length * 100).toFixed(1)
            },
            prediction: prediction,
            headToHead: h2hStats,
            insights: insights,
            keyPlayers: this.identifyKeyPlayers(team1Stats, team2Stats)
        };
    }
    
    createDefaultStats(playerName) {
        return {
            name: playerName,
            games: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goals: 0,
            assists: 0,
            points: 0,
            ppg: 0,
            winPercent: 0,
            goalsPerGame: 0,
            formRating: 50,
            reliability: 0.1 // Low reliability for new players
        };
    }
    
    calculateWeightedMetrics(playerStats) {
        let totalWeight = 0;
        let weightedPPG = 0;
        let weightedWinPct = 0;
        let weightedGoalsPerGame = 0;
        let weightedForm = 0;
        
        playerStats.forEach(stat => {
            const weight = stat.reliability;
            totalWeight += weight;
            weightedPPG += stat.ppg * weight;
            weightedWinPct += stat.winPercent * weight;
            weightedGoalsPerGame += stat.goalsPerGame * weight;
            weightedForm += stat.formRating * weight;
        });
        
        if (totalWeight === 0) totalWeight = 1;
        
        return {
            ppg: (weightedPPG / totalWeight).toFixed(2),
            winPercent: (weightedWinPct / totalWeight).toFixed(1),
            goalsPerGame: (weightedGoalsPerGame / totalWeight).toFixed(2),
            formRating: (weightedForm / totalWeight).toFixed(1),
            totalWeight: totalWeight
        };
    }
    
    calculateTeamSynergy(players) {
        if (players.length < 2) return { score: 0, hasData: false };
        
        let totalSynergy = 0;
        let pairsAnalyzed = 0;
        
        for (let i = 0; i < players.length; i++) {
            for (let j = i + 1; j < players.length; j++) {
                const pairKey = [players[i], players[j]].sort().join('|');
                const pair = this.playerPairs[pairKey];
                
                if (pair && pair.gamesTogether >= 2) {
                    totalSynergy += parseFloat(pair.synergyScore);
                    pairsAnalyzed++;
                }
            }
        }
        
        return {
            score: pairsAnalyzed > 0 ? (totalSynergy / pairsAnalyzed).toFixed(2) : 0,
            pairsAnalyzed: pairsAnalyzed,
            hasData: pairsAnalyzed > 0,
            description: this.getSynergyDescription(totalSynergy / Math.max(1, pairsAnalyzed))
        };
    }
    
    getSynergyDescription(synergyScore) {
        if (synergyScore > 0.3) return "Excellent chemistry - players complement each other well";
        if (synergyScore > 0.1) return "Good chemistry - positive track record together";
        if (synergyScore > -0.1) return "Neutral chemistry - no strong patterns";
        if (synergyScore > -0.3) return "Poor chemistry - may struggle to coordinate";
        return "Very poor chemistry - historically perform worse together";
    }
    
    calculateHeadToHead(team1Players, team2Players) {
        let team1Wins = 0;
        let team2Wins = 0;
        let draws = 0;
        let totalGames = 0;
        let goalsScored = 0;
        let goalsConceded = 0;
        
        const team1Set = new Set(team1Players);
        const team2Set = new Set(team2Players);
        
        // Find all games where these players faced each other
        const games = {};
        
        this.gameLog.forEach(game => {
            const player = game['Player'];
            const gameId = game['ID'];
            
            if (!games[gameId]) {
                games[gameId] = { teams: {}, date: game['Date'] };
            }
            
            const team = game['Team'];
            if (!games[gameId].teams[team]) {
                games[gameId].teams[team] = { players: [], result: null, goals: 0 };
            }
            
            games[gameId].teams[team].players.push(player);
            games[gameId].teams[team].result = game['Result'];
            games[gameId].teams[team].goals += parseInt(game['Gls']) || 0;
        });
        
        // Analyze relevant games
        Object.values(games).forEach(game => {
            const teams = Object.values(game.teams);
            if (teams.length === 2) {
                const hasTeam1Player = teams[0].players.some(p => team1Set.has(p)) || 
                                      teams[1].players.some(p => team1Set.has(p));
                const hasTeam2Player = teams[0].players.some(p => team2Set.has(p)) || 
                                      teams[1].players.some(p => team2Set.has(p));
                
                if (hasTeam1Player && hasTeam2Player) {
                    totalGames++;
                    
                    // Determine which team has team1 players
                    let team1Team = null;
                    let team2Team = null;
                    
                    if (teams[0].players.some(p => team1Set.has(p))) {
                        team1Team = teams[0];
                        team2Team = teams[1];
                    } else if (teams[1].players.some(p => team1Set.has(p))) {
                        team1Team = teams[1];
                        team2Team = teams[0];
                    }
                    
                    if (team1Team && team2Team) {
                        if (team1Team.result === 'Win') {
                            team1Wins++;
                            goalsScored += team1Team.goals;
                            goalsConceded += team2Team.goals;
                        } else if (team2Team.result === 'Win') {
                            team2Wins++;
                            goalsScored += team1Team.goals;
                            goalsConceded += team2Team.goals;
                        } else {
                            draws++;
                            goalsScored += team1Team.goals;
                            goalsConceded += team2Team.goals;
                        }
                    }
                }
            }
        });
        
        return {
            totalGames: totalGames,
            team1Wins: team1Wins,
            team2Wins: team2Wins,
            draws: draws,
            team1WinPct: totalGames > 0 ? (team1Wins / totalGames * 100) : 0,
            team2WinPct: totalGames > 0 ? (team2Wins / totalGames * 100) : 0,
            drawPct: totalGames > 0 ? (draws / totalGames * 100) : 0,
            avgGoalsScored: totalGames > 0 ? (goalsScored / totalGames).toFixed(1) : 0,
            avgGoalsConceded: totalGames > 0 ? (goalsConceded / totalGames).toFixed(1) : 0,
            hasData: totalGames > 0
        };
    }
    
    calculatePrediction(team1Metrics, team2Metrics, team1Synergy, team2Synergy, h2hStats, team1Weight, team2Weight) {
        let team1Score = 50; // Start neutral
        
        // Factor 1: Individual player performance (40% weight)
        const ppgDiff = (team1Metrics.ppg - team2Metrics.ppg) * 10;
        team1Score += ppgDiff * 0.4;
        
        // Factor 2: Current form (30% weight)
        const formDiff = (team1Metrics.formRating - team2Metrics.formRating) * 0.3;
        team1Score += formDiff * 0.3;
        
        // Factor 3: Team synergy (15% weight)
        const synergyDiff = (team1Synergy.score - team2Synergy.score) * 15;
        team1Score += synergyDiff * 0.15;
        
        // Factor 4: Head-to-head history (10% weight)
        if (h2hStats.hasData) {
            const h2hDiff = h2hStats.team1WinPct - h2hStats.team2WinPct;
            team1Score += h2hDiff * 0.1;
        }
        
        // Factor 5: Experience/reliability (5% weight)
        const reliabilityDiff = (team1Weight - team2Weight) / Math.max(team1Weight, team2Weight) * 10;
        team1Score += reliabilityDiff * 0.05;
        
        // Clamp between 0 and 100
        team1Score = Math.max(5, Math.min(95, team1Score));
        
        // Calculate confidence based on data availability
        let confidence = 50;
        const hasReliableData = team1Weight > 5 && team2Weight > 5;
        const hasH2H = h2hStats.hasData;
        const hasSynergy = team1Synergy.hasData || team2Synergy.hasData;
        
        if (hasReliableData) confidence += 20;
        if (hasH2H) confidence += 15;
        if (hasSynergy) confidence += 10;
        
        // Reduce confidence for close predictions
        const margin = Math.abs(team1Score - 50);
        if (margin < 10) confidence -= 15;
        else if (margin > 30) confidence += 10;
        
        confidence = Math.min(95, Math.max(30, confidence));
        
        return {
            team1WinProb: team1Score,
            team2WinProb: 100 - team1Score,
            predictedWinner: team1Score > 50 ? "Team 1" : "Team 2",
            confidence: confidence.toFixed(1),
            margin: Math.abs(team1Score - 50).toFixed(1),
            keyFactors: this.generateKeyFactors(team1Metrics, team2Metrics, team1Synergy, team2Synergy, h2hStats)
        };
    }
    
    generateKeyFactors(team1Metrics, team2Metrics, team1Synergy, team2Synergy, h2hStats) {
        const factors = [];
        
        // Individual performance
        if (team1Metrics.ppg > team2Metrics.ppg + 0.5) {
            factors.push(`📊 Team 1 has higher individual player ratings (${team1Metrics.ppg} vs ${team2Metrics.ppg} PPG)`);
        } else if (team2Metrics.ppg > team1Metrics.ppg + 0.5) {
            factors.push(`📊 Team 2 has higher individual player ratings (${team2Metrics.ppg} vs ${team1Metrics.ppg} PPG)`);
        }
        
        // Form
        if (team1Metrics.formRating > team2Metrics.formRating + 10) {
            factors.push(`🔥 Team 1 players are in significantly better form (${team1Metrics.formRating}% vs ${team2Metrics.formRating}%)`);
        } else if (team2Metrics.formRating > team1Metrics.formRating + 10) {
            factors.push(`🔥 Team 2 players are in significantly better form (${team2Metrics.formRating}% vs ${team1Metrics.formRating}%)`);
        }
        
        // Synergy
        if (team1Synergy.score > team2Synergy.score + 0.2 && team1Synergy.hasData) {
            factors.push(`🤝 Team 1 has better team chemistry (${team1Synergy.description.toLowerCase()})`);
        } else if (team2Synergy.score > team1Synergy.score + 0.2 && team2Synergy.hasData) {
            factors.push(`🤝 Team 2 has better team chemistry (${team2Synergy.description.toLowerCase()})`);
        }
        
        // Head-to-head
        if (h2hStats.hasData && h2hStats.totalGames >= 3) {
            if (h2hStats.team1WinPct > 60) {
                factors.push(`🏆 Team 1 has dominated previous encounters (${h2hStats.team1WinPct.toFixed(0)}% win rate in ${h2hStats.totalGames} games)`);
            } else if (h2hStats.team2WinPct > 60) {
                factors.push(`🏆 Team 2 has dominated previous encounters (${h2hStats.team2WinPct.toFixed(0)}% win rate in ${h2hStats.totalGames} games)`);
            }
        }
        
        if (factors.length === 0) {
            factors.push("⚖️ Very evenly matched - could go either way!");
        }
        
        return factors;
    }
    
    generateInsights(team1Stats, team2Stats, team1Synergy, team2Synergy, h2hStats) {
        const insights = [];
        
        // Find highest impact players
        const allPlayers = [...team1Stats, ...team2Stats];
        const topPerformers = allPlayers
            .sort((a, b) => (b.ppg * b.reliability) - (a.ppg * a.reliability))
            .slice(0, 3);
        
        insights.push(`⭐ Key player${topPerformers.length > 1 ? 's' : ''} to watch: ${topPerformers.map(p => p.name).join(', ')}`);
        
        // Find players in poor form
        const poorForm = allPlayers.filter(p => p.formRating < 40 && p.games > 5);
        if (poorForm.length > 0) {
            insights.push(`⚠️ ${poorForm.map(p => p.name).join(', ')} ${poorForm.length === 1 ? 'is' : 'are'} out of form - potential weak ${poorForm.length === 1 ? 'link' : 'links'}`);
        }
        
        // Goal threat assessment
        const team1GoalThreat = team1Stats.reduce((sum, p) => sum + p.goalsPerGame * p.reliability, 0) / 
                                team1Stats.reduce((sum, p) => sum + p.reliability, 1);
        const team2GoalThreat = team2Stats.reduce((sum, p) => sum + p.goalsPerGame * p.reliability, 0) / 
                                team2Stats.reduce((sum, p) => sum + p.reliability, 1);
        
        if (team1GoalThreat > team2GoalThreat + 0.5) {
            insights.push(`⚽ Team 1 has higher goal scoring potential (${team1GoalThreat.toFixed(2)} vs ${team2GoalThreat.toFixed(2)} goals/game)`);
        } else if (team2GoalThreat > team1GoalThreat + 0.5) {
            insights.push(`⚽ Team 2 has higher goal scoring potential (${team2GoalThreat.toFixed(2)} vs ${team1GoalThreat.toFixed(2)} goals/game)`);
        }
        
        // Experience gap
        const team1Exp = team1Stats.reduce((sum, p) => sum + p.games, 0);
        const team2Exp = team2Stats.reduce((sum, p) => sum + p.games, 0);
        
        if (Math.abs(team1Exp - team2Exp) > 50) {
            const moreExp = team1Exp > team2Exp ? "Team 1" : "Team 2";
            insights.push(`🎓 ${moreExp} has significantly more experience (${Math.max(team1Exp, team2Exp)} vs ${Math.min(team1Exp, team2Exp)} total games)`);
        }
        
        return insights;
    }
    
    identifyKeyPlayers(team1Stats, team2Stats) {
        const allPlayers = [...team1Stats, ...team2Stats];
        
        return {
            topScorer: allPlayers.sort((a, b) => b.goals - a.goals)[0],
            bestCreator: allPlayers.sort((a, b) => b.assists - a.assists)[0],
            mostReliable: allPlayers.sort((a, b) => b.reliability - a.reliability)[0],
            inForm: allPlayers.sort((a, b) => b.formRating - a.formRating)[0]
        };
    }
    
    generateHTMLReport(analysis) {
        const team1 = analysis.team1;
        const team2 = analysis.team2;
        const pred = analysis.prediction;
        const h2h = analysis.headToHead;
        
        // Determine confidence color
        const confidenceColor = pred.confidence > 70 ? 'success' : (pred.confidence > 50 ? 'warning' : 'secondary');
        
        return `
            <div class="analysis-card">
                <div class="prediction-header">
                    <h3><i class="fas fa-chart-line"></i> Match Prediction</h3>
                    <div class="prediction-bars">
                        <div class="progress" style="height: 50px;">
                            <div class="progress-bar bg-primary" style="width: ${pred.team1WinProb}%; line-height: 50px;">
                                ${pred.team1WinProb.toFixed(1)}%
                            </div>
                            <div class="progress-bar bg-danger" style="width: ${pred.team2WinProb}%; line-height: 50px;">
                                ${pred.team2WinProb.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                    <div class="mt-2">
                        <span class="badge bg-${confidenceColor}">Confidence: ${pred.confidence}%</span>
                        <span class="badge bg-info">Predicted Winner: ${pred.predictedWinner}</span>
                    </div>
                </div>
                
                <div class="key-factors">
                    <h4><i class="fas fa-key"></i> Key Factors</h4>
                    <ul>
                        ${pred.keyFactors.map(f => `<li>${f}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="team-comparison">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="team-card">
                                <h4>${team1.name}</h4>
                                <div class="stat">Team PPG: <strong>${team1.metrics.ppg}</strong></div>
                                <div class="stat">Team Win %: <strong>${team1.metrics.winPercent}%</strong></div>
                                <div class="stat">Team Form: <strong>${team1.metrics.formRating}%</strong></div>
                                <div class="stat">Goals/Game: <strong>${team1.metrics.goalsPerGame}</strong></div>
                                <div class="stat">Chemistry: <strong>${team1.synergy.description || 'Not enough data'}</strong></div>
                                <div class="stat">Data Reliability: <strong>${team1.avgReliability}%</strong></div>
                                <div class="stat mt-2">Total Games Played: <strong>${team1.totalGames}</strong></div>
                                <div class="stat">Total Goals: <strong>${team1.totalGoals}</strong></div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="team-card">
                                <h4>${team2.name}</h4>
                                <div class="stat">Team PPG: <strong>${team2.metrics.ppg}</strong></div>
                                <div class="stat">Team Win %: <strong>${team2.metrics.winPercent}%</strong></div>
                                <div class="stat">Team Form: <strong>${team2.metrics.formRating}%</strong></div>
                                <div class="stat">Goals/Game: <strong>${team2.metrics.goalsPerGame}</strong></div>
                                <div class="stat">Chemistry: <strong>${team2.synergy.description || 'Not enough data'}</strong></div>
                                <div class="stat">Data Reliability: <strong>${team2.avgReliability}%</strong></div>
                                <div class="stat mt-2">Total Games Played: <strong>${team2.totalGames}</strong></div>
                                <div class="stat">Total Goals: <strong>${team2.totalGoals}</strong></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${h2h.hasData ? `
                <div class="head-to-head">
                    <h4><i class="fas fa-history"></i> Head-to-Head History</h4>
                    <div class="row text-center">
                        <div class="col-md-3">
                            <div class="h2h-stat">${h2h.totalGames} Games</div>
                        </div>
                        <div class="col-md-3">
                            <div class="h2h-stat text-primary">${team1.name}: ${h2h.team1Wins}W</div>
                        </div>
                        <div class="col-md-3">
                            <div class="h2h-stat text-danger">${team2.name}: ${h2h.team2Wins}W</div>
                        </div>
                        <div class="col-md-3">
                            <div class="h2h-stat">Draws: ${h2h.draws}</div>
                        </div>
                    </div>
                    <div class="row mt-2 text-center">
                        <div class="col-6">
                            <div class="small">Avg Goals Scored: ${h2h.avgGoalsScored}</div>
                        </div>
                        <div class="col-6">
                            <div class="small">Avg Goals Conceded: ${h2h.avgGoalsConceded}</div>
                        </div>
                    </div>
                </div>
                ` : '<div class="head-to-head text-muted">No head-to-head history between these player groups</div>'}
                
                <div class="insights">
                    <h4><i class="fas fa-lightbulb"></i> Key Insights</h4>
                    <ul>
                        ${analysis.insights.map(i => `<li>${i}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="key-players">
                    <h4><i class="fas fa-star"></i> Key Players</h4>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="player-highlight">
                                <i class="fas fa-futbol"></i> Top Scorer: <strong>${analysis.keyPlayers.topScorer?.name || 'N/A'}</strong>
                                <small>(${analysis.keyPlayers.topScorer?.goals || 0} goals)</small>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="player-highlight">
                                <i class="fas fa-handshake"></i> Best Creator: <strong>${analysis.keyPlayers.bestCreator?.name || 'N/A'}</strong>
                                <small>(${analysis.keyPlayers.bestCreator?.assists || 0} assists)</small>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="player-highlight">
                                <i class="fas fa-chart-line"></i> In Form: <strong>${analysis.keyPlayers.inForm?.name || 'N/A'}</strong>
                                <small>(${analysis.keyPlayers.inForm?.formRating || 0}% last 5)</small>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="player-highlight">
                                <i class="fas fa-shield-alt"></i> Most Reliable: <strong>${analysis.keyPlayers.mostReliable?.name || 'N/A'}</strong>
                                <small>(${analysis.keyPlayers.mostReliable?.games || 0} games)</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="player-stats mt-3">
                    <h4><i class="fas fa-users"></i> Player Breakdown</h4>
                    <div class="row">
                        <div class="col-md-6">
                            <h5>${team1.name}</h5>
                            ${team1.stats.sort((a,b) => b.ppg - a.ppg).map(p => `
                                <div class="player-stat">
                                    <strong>${p.name}</strong>
                                    <span class="badge bg-secondary float-end">${p.games} games</span>
                                    <div class="small">
                                        PPG: ${p.ppg} | Form: ${p.formRating}% | 
                                        ${p.goals}G / ${p.assists}A
                                    </div>
                                    <div class="progress" style="height: 3px;">
                                        <div class="progress-bar bg-success" style="width: ${p.reliability * 100}%"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="col-md-6">
                            <h5>${team2.name}</h5>
                            ${team2.stats.sort((a,b) => b.ppg - a.ppg).map(p => `
                                <div class="player-stat">
                                    <strong>${p.name}</strong>
                                    <span class="badge bg-secondary float-end">${p.games} games</span>
                                    <div class="small">
                                        PPG: ${p.ppg} | Form: ${p.formRating}% | 
                                        ${p.goals}G / ${p.assists}A
                                    </div>
                                    <div class="progress" style="height: 3px;">
                                        <div class="progress-bar bg-success" style="width: ${p.reliability * 100}%"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
