// Pre-Match Analysis Tool - Optimized for Large Player Pool
class PreMatchAnalyzer {
    constructor(gameLog, leagueTable) {
        this.gameLog = gameLog;
        this.leagueTable = leagueTable;
        this.playerStats = {};
        this.playerPairs = {};
        this.playerHeadToHead = {};
        this.init();
    }
    
    init() {
        console.log("Initializing pre-match analyzer with", this.gameLog.length, "games");
        this.calculatePlayerStats();
        this.calculatePlayerSynergies();
        this.calculatePlayerHeadToHead();
    }
    
    calculatePlayerStats() {
        console.log("Calculating player statistics...");
        
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
                    reliability: Math.min(1, player.Games / 20)
                };
            });
        }
        
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
        
        Object.values(this.playerStats).forEach(stats => {
            const validGames = stats.last5Games.filter(g => g !== undefined);
            const gamesPlayed = validGames.length;
            
            if (gamesPlayed >= 3) {
                const formPoints = validGames.reduce((sum, g) => sum + g.points, 0);
                const maxPoints = gamesPlayed * 3;
                stats.formRating = (formPoints / maxPoints * 100).toFixed(1);
                stats.formGoals = validGames.reduce((sum, g) => sum + g.goals, 0);
                stats.formAssists = validGames.reduce((sum, g) => sum + g.assists, 0);
                stats.formGames = gamesPlayed;
            } else {
                stats.formRating = null;
                stats.formGoals = 0;
                stats.formAssists = 0;
                stats.formGames = gamesPlayed;
            }
            
            stats.reliability = Math.min(1, (stats.games / 30) * 0.7 + (stats.last5Games.length / 5) * 0.3);
            
            if (stats.games >= 5) {
                stats.impactScore = (
                    (parseFloat(stats.ppg) * 0.4) +
                    (stats.goalsPerGame * 15) +
                    (stats.assistsPerGame * 10) +
                    (stats.reliability * 20)
                ).toFixed(1);
            } else {
                stats.impactScore = null;
            }
        });
    }
    
    calculatePlayerHeadToHead() {
        console.log("Calculating player head-to-head statistics...");
        
        const games = {};
        
        this.gameLog.forEach(game => {
            const gameId = game['ID'];
            if (!games[gameId]) {
                games[gameId] = {
                    teams: {},
                    date: game['Date']
                };
            }
            
            const team = game['Team'];
            if (!games[gameId].teams[team]) {
                games[gameId].teams[team] = {
                    players: [],
                    result: null,
                    goals: 0
                };
            }
            
            games[gameId].teams[team].players.push(game['Player']);
            games[gameId].teams[team].result = game['Result'];
            games[gameId].teams[team].goals += parseInt(game['Gls']) || 0;
        });
        
        Object.values(games).forEach(game => {
            const teams = Object.values(game.teams);
            if (teams.length === 2) {
                const team1Players = teams[0].players;
                const team2Players = teams[1].players;
                const team1Result = teams[0].result;
                const team2Result = teams[1].result;
                
                team1Players.forEach(player1 => {
                    if (!this.playerHeadToHead[player1]) {
                        this.playerHeadToHead[player1] = {};
                    }
                    
                    team2Players.forEach(player2 => {
                        if (!this.playerHeadToHead[player1][player2]) {
                            this.playerHeadToHead[player1][player2] = {
                                games: 0,
                                wins: 0,
                                draws: 0,
                                losses: 0,
                                goals: 0,
                                conceded: 0
                            };
                        }
                        
                        const stats = this.playerHeadToHead[player1][player2];
                        stats.games++;
                        
                        if (team1Result === 'Win') {
                            stats.wins++;
                        } else if (team1Result === 'Draw') {
                            stats.draws++;
                        } else {
                            stats.losses++;
                        }
                        
                        stats.goals += teams[0].goals;
                        stats.conceded += teams[1].goals;
                    });
                });
                
                team2Players.forEach(player2 => {
                    if (!this.playerHeadToHead[player2]) {
                        this.playerHeadToHead[player2] = {};
                    }
                    
                    team1Players.forEach(player1 => {
                        if (!this.playerHeadToHead[player2][player1]) {
                            this.playerHeadToHead[player2][player1] = {
                                games: 0,
                                wins: 0,
                                draws: 0,
                                losses: 0,
                                goals: 0,
                                conceded: 0
                            };
                        }
                        
                        const stats = this.playerHeadToHead[player2][player1];
                        stats.games++;
                        
                        if (team2Result === 'Win') {
                            stats.wins++;
                        } else if (team2Result === 'Draw') {
                            stats.draws++;
                        } else {
                            stats.losses++;
                        }
                        
                        stats.goals += teams[1].goals;
                        stats.conceded += teams[0].goals;
                    });
                });
            }
        });
        
        Object.values(this.playerHeadToHead).forEach(playerMatchups => {
            Object.values(playerMatchups).forEach(matchup => {
                if (matchup.games > 0) {
                    matchup.winPercent = (matchup.wins / matchup.games * 100).toFixed(1);
                    matchup.goalsPerGame = (matchup.goals / matchup.games).toFixed(2);
                }
            });
        });
    }
    
    calculatePlayerSynergies() {
        console.log("Calculating player synergies...");
        
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
        
        Object.values(gameTeams).forEach(game => {
            const teams = Object.values(game.teams);
            if (teams.length === 2) {
                const team1Players = teams[0].players;
                const team2Players = teams[1].players;
                const team1Result = teams[0].result;
                const team2Result = teams[1].result;
                
                const winningTeam = team1Result === 'Win' ? team1Players : 
                                   (team2Result === 'Win' ? team2Players : null);
                
                if (winningTeam) {
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
                        }
                    }
                }
            }
        });
        
        Object.values(this.playerPairs).forEach(pair => {
            pair.winRate = pair.gamesTogether > 0 ? 
                (pair.winsTogether / pair.gamesTogether * 100).toFixed(1) : 0;
            pair.synergyScore = pair.gamesTogether >= 2 ?
                ((pair.winsTogether / pair.gamesTogether - 0.5) * 2).toFixed(2) : 0;
        });
    }
    
    analyzeTeams(team1Players, team2Players, team1Name = "Team 1", team2Name = "Team 2") {
        console.log("Analyzing matchup with", team1Players.length, "vs", team2Players.length, "players");
        
        const team1Stats = team1Players.map(p => this.playerStats[p] || this.createDefaultStats(p));
        const team2Stats = team2Players.map(p => this.playerStats[p] || this.createDefaultStats(p));
        
        const team1Weight = team1Stats.reduce((sum, s) => sum + s.reliability, 0);
        const team2Weight = team2Stats.reduce((sum, s) => sum + s.reliability, 0);
        
        const team1Metrics = this.calculateWeightedMetrics(team1Stats);
        const team2Metrics = this.calculateWeightedMetrics(team2Stats);
        
        const team1Synergy = this.calculateTeamSynergy(team1Players);
        const team2Synergy = this.calculateTeamSynergy(team2Players);
        
        const playerH2HStats = this.calculatePlayerHeadToHeadStats(team1Players, team2Players);
        
        const prediction = this.calculatePrediction(
            team1Metrics, team2Metrics, 
            team1Synergy, team2Synergy, 
            playerH2HStats,
            team1Weight, team2Weight,
            team1Name, team2Name
        );
        
        const insights = this.generateInsights(
            team1Stats, team2Stats, 
            team1Synergy, team2Synergy,
            playerH2HStats,
            team1Name, team2Name
        );
        
        return {
            team1: {
                name: team1Name,
                players: team1Players,
                stats: team1Stats,
                metrics: team1Metrics,
                synergy: team1Synergy,
                totalGames: team1Stats.reduce((sum, s) => sum + s.games, 0),
                totalGoals: team1Stats.reduce((sum, s) => sum + s.goals, 0),
                avgReliability: (team1Weight / team1Stats.length * 100).toFixed(1)
            },
            team2: {
                name: team2Name,
                players: team2Players,
                stats: team2Stats,
                metrics: team2Metrics,
                synergy: team2Synergy,
                totalGames: team2Stats.reduce((sum, s) => sum + s.games, 0),
                totalGoals: team2Stats.reduce((sum, s) => sum + s.goals, 0),
                avgReliability: (team2Weight / team2Stats.length * 100).toFixed(1)
            },
            prediction: prediction,
            playerHeadToHead: playerH2HStats,
            insights: insights,
            keyPlayers: this.identifyKeyPlayers(team1Stats, team2Stats)
        };
    }
    
    calculatePlayerHeadToHeadStats(team1Players, team2Players) {
        const stats = {
            totalMatchups: 0,
            team1Advantage: 0,
            team2Advantage: 0,
            keyMatchups: [],
            team1WinRateVsOpponents: 0,
            team2WinRateVsOpponents: 0,
            hasData: false
        };
        
        let totalTeam1Wins = 0;
        let totalTeam2Wins = 0;
        let totalMatchupGames = 0;
        
        team1Players.forEach(player1 => {
            team2Players.forEach(player2 => {
                const matchup = this.playerHeadToHead[player1]?.[player2];
                if (matchup && matchup.games >= 2) {
                    stats.totalMatchups++;
                    totalMatchupGames += matchup.games;
                    
                    if (matchup.winPercent > 50) {
                        stats.team1Advantage++;
                    } else if (matchup.winPercent < 50) {
                        stats.team2Advantage++;
                    }
                    
                    totalTeam1Wins += matchup.wins;
                    totalTeam2Wins += matchup.losses;
                    
                    if (matchup.winPercent >= 65 && matchup.games >= 3) {
                        stats.keyMatchups.push({
                            winner: player1,
                            loser: player2,
                            winRate: matchup.winPercent,
                            games: matchup.games,
                            goalsPerGame: matchup.goalsPerGame
                        });
                    } else if (matchup.winPercent <= 35 && matchup.games >= 3) {
                        stats.keyMatchups.push({
                            winner: player2,
                            loser: player1,
                            winRate: 100 - matchup.winPercent,
                            games: matchup.games,
                            goalsPerGame: matchup.goalsPerGame
                        });
                    }
                }
            });
        });
        
        if (totalMatchupGames > 0) {
            stats.team1WinRateVsOpponents = (totalTeam1Wins / totalMatchupGames * 100).toFixed(1);
            stats.team2WinRateVsOpponents = (totalTeam2Wins / totalMatchupGames * 100).toFixed(1);
            stats.hasData = true;
        }
        
        return stats;
    }
    
    calculateWeightedMetrics(playerStats) {
        let totalWeight = 0;
        let weightedPPG = 0;
        let weightedWinPct = 0;
        let weightedGoalsPerGame = 0;
        let weightedForm = 0;
        let validFormCount = 0;
        
        playerStats.forEach(stat => {
            const weight = stat.reliability;
            totalWeight += weight;
            weightedPPG += parseFloat(stat.ppg) * weight;
            weightedWinPct += parseFloat(stat.winPercent) * weight;
            weightedGoalsPerGame += stat.goalsPerGame * weight;
            
            if (stat.formRating !== null) {
                weightedForm += parseFloat(stat.formRating) * weight;
                validFormCount++;
            }
        });
        
        if (totalWeight === 0) totalWeight = 1;
        
        return {
            ppg: (weightedPPG / totalWeight).toFixed(2),
            winPercent: (weightedWinPct / totalWeight).toFixed(1),
            goalsPerGame: (weightedGoalsPerGame / totalWeight).toFixed(2),
            formRating: validFormCount > 0 ? (weightedForm / totalWeight).toFixed(1) : "N/A",
            totalWeight: totalWeight
        };
    }
    
    calculateTeamSynergy(players) {
        if (players.length < 2) return { score: 0, hasData: false, description: "Not enough players for synergy analysis" };
        
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
        
        const avgSynergy = pairsAnalyzed > 0 ? (totalSynergy / pairsAnalyzed) : 0;
        
        return {
            score: avgSynergy.toFixed(2),
            pairsAnalyzed: pairsAnalyzed,
            hasData: pairsAnalyzed > 0,
            description: this.getSynergyDescription(avgSynergy)
        };
    }
    
    getSynergyDescription(synergyScore) {
        if (synergyScore > 0.3) return "Excellent chemistry - players complement each other well";
        if (synergyScore > 0.1) return "Good chemistry - positive track record together";
        if (synergyScore > -0.1) return "Neutral chemistry - no strong patterns";
        if (synergyScore > -0.3) return "Poor chemistry - may struggle to coordinate";
        return "Very poor chemistry - historically perform worse together";
    }
    
    calculatePrediction(team1Metrics, team2Metrics, team1Synergy, team2Synergy, playerH2HStats, team1Weight, team2Weight, team1Name, team2Name) {
        let team1Score = 50;
        
        const ppgDiff = (parseFloat(team1Metrics.ppg) - parseFloat(team2Metrics.ppg)) * 10;
        team1Score += ppgDiff * 0.35;
        
        if (team1Metrics.formRating !== "N/A" && team2Metrics.formRating !== "N/A") {
            const formDiff = (parseFloat(team1Metrics.formRating) - parseFloat(team2Metrics.formRating)) * 0.3;
            team1Score += formDiff * 0.25;
        } else {
            team1Score += (parseFloat(team1Metrics.winPercent) - parseFloat(team2Metrics.winPercent)) * 0.15;
        }
        
        const synergyDiff = (parseFloat(team1Synergy.score) - parseFloat(team2Synergy.score)) * 15;
        team1Score += synergyDiff * 0.15;
        
        if (playerH2HStats.hasData) {
            const h2hDiff = parseFloat(playerH2HStats.team1WinRateVsOpponents) - parseFloat(playerH2HStats.team2WinRateVsOpponents);
            team1Score += h2hDiff * 0.15;
        }
        
        const reliabilityDiff = (team1Weight - team2Weight) / Math.max(team1Weight, team2Weight) * 10;
        team1Score += reliabilityDiff * 0.10;
        
        team1Score = Math.max(5, Math.min(95, team1Score));
        
        let confidence = 50;
        const hasReliableData = team1Weight > 5 && team2Weight > 5;
        const hasH2H = playerH2HStats.hasData;
        const hasSynergy = team1Synergy.hasData || team2Synergy.hasData;
        const hasFormData = team1Metrics.formRating !== "N/A" && team2Metrics.formRating !== "N/A";
        
        if (hasReliableData) confidence += 15;
        if (hasH2H) confidence += 10;
        if (hasSynergy) confidence += 10;
        if (hasFormData) confidence += 10;
        
        const margin = Math.abs(team1Score - 50);
        if (margin < 10) confidence -= 10;
        else if (margin > 30) confidence += 10;
        
        confidence = Math.min(90, Math.max(40, confidence));
        
        return {
            team1WinProb: team1Score,
            team2WinProb: 100 - team1Score,
            predictedWinner: team1Score > 50 ? team1Name : team2Name,
            confidence: confidence.toFixed(1),
            margin: Math.abs(team1Score - 50).toFixed(1),
            keyFactors: this.generateKeyFactors(team1Metrics, team2Metrics, team1Synergy, team2Synergy, playerH2HStats, team1Name, team2Name)
        };
    }
    
    generateKeyFactors(team1Metrics, team2Metrics, team1Synergy, team2Synergy, playerH2HStats, team1Name, team2Name) {
        const factors = [];
        
        if (parseFloat(team1Metrics.ppg) > parseFloat(team2Metrics.ppg) + 0.5) {
            factors.push(`📊 ${team1Name} has higher individual player ratings (${team1Metrics.ppg} vs ${team2Metrics.ppg} PPG)`);
        } else if (parseFloat(team2Metrics.ppg) > parseFloat(team1Metrics.ppg) + 0.5) {
            factors.push(`📊 ${team2Name} has higher individual player ratings (${team2Metrics.ppg} vs ${team1Metrics.ppg} PPG)`);
        }
        
        if (team1Metrics.formRating !== "N/A" && team2Metrics.formRating !== "N/A") {
            if (parseFloat(team1Metrics.formRating) > parseFloat(team2Metrics.formRating) + 10) {
                factors.push(`🔥 ${team1Name} players are in significantly better form (${team1Metrics.formRating}% vs ${team2Metrics.formRating}%)`);
            } else if (parseFloat(team2Metrics.formRating) > parseFloat(team1Metrics.formRating) + 10) {
                factors.push(`🔥 ${team2Name} players are in significantly better form (${team2Metrics.formRating}% vs ${team1Metrics.formRating}%)`);
            }
        }
        
        if (team1Synergy.hasData && team2Synergy.hasData) {
            if (parseFloat(team1Synergy.score) > parseFloat(team2Synergy.score) + 0.2) {
                factors.push(`🤝 ${team1Name} has better team chemistry (${team1Synergy.description.toLowerCase()})`);
            } else if (parseFloat(team2Synergy.score) > parseFloat(team1Synergy.score) + 0.2) {
                factors.push(`🤝 ${team2Name} has better team chemistry (${team2Synergy.description.toLowerCase()})`);
            }
        }
        
        if (playerH2HStats.hasData && playerH2HStats.totalMatchups > 0) {
            if (parseFloat(playerH2HStats.team1WinRateVsOpponents) > 55) {
                factors.push(`🏆 ${team1Name} players have historically dominated matchups against ${team2Name} players (${playerH2HStats.team1WinRateVsOpponents}% win rate)`);
            } else if (parseFloat(playerH2HStats.team2WinRateVsOpponents) > 55) {
                factors.push(`🏆 ${team2Name} players have historically dominated matchups against ${team1Name} players (${playerH2HStats.team2WinRateVsOpponents}% win rate)`);
            }
            
            if (playerH2HStats.keyMatchups.length > 0) {
                const topMatchup = playerH2HStats.keyMatchups[0];
                factors.push(`⚡ Key matchup: ${topMatchup.winner} dominates ${topMatchup.loser} (${topMatchup.winRate}% win rate over ${topMatchup.games} games)`);
            }
        }
        
        if (factors.length === 0) {
            factors.push("⚖️ Very evenly matched - could go either way!");
        }
        
        return factors.slice(0, 5);
    }
    
    generateInsights(team1Stats, team2Stats, team1Synergy, team2Synergy, playerH2HStats, team1Name, team2Name) {
        const insights = [];
        
        const allPlayers = [...team1Stats, ...team2Stats];
        const qualifiedPlayers = allPlayers.filter(p => p.games >= 5);
        
        if (qualifiedPlayers.length > 0) {
            const topPerformers = qualifiedPlayers
                .sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0))
                .slice(0, 3);
            
            if (topPerformers.length > 0) {
                insights.push(`⭐ Highest impact player${topPerformers.length > 1 ? 's' : ''}: ${topPerformers.map(p => `${p.name} (${p.impactScore})`).join(', ')}`);
            }
        }
        
        const poorForm = allPlayers.filter(p => p.formRating !== null && parseFloat(p.formRating) < 40 && p.games >= 5);
        if (poorForm.length > 0) {
            insights.push(`⚠️ ${poorForm.map(p => p.name).join(', ')} ${poorForm.length === 1 ? 'is' : 'are'} out of form - potential weak ${poorForm.length === 1 ? 'link' : 'links'}`);
        }
        
        const hotForm = allPlayers.filter(p => p.formRating !== null && parseFloat(p.formRating) >= 70 && p.games >= 5);
        if (hotForm.length > 0) {
            insights.push(`🔥 ${hotForm.map(p => p.name).join(', ')} ${hotForm.length === 1 ? 'is' : 'are'} in excellent form!`);
        }
        
        const team1Qualified = team1Stats.filter(p => p.games >= 5);
        const team2Qualified = team2Stats.filter(p => p.games >= 5);
        
        if (team1Qualified.length > 0 && team2Qualified.length > 0) {
            const team1GoalThreat = team1Qualified.reduce((sum, p) => sum + p.goalsPerGame, 0) / team1Qualified.length;
            const team2GoalThreat = team2Qualified.reduce((sum, p) => sum + p.goalsPerGame, 0) / team2Qualified.length;
            
            if (team1GoalThreat > team2GoalThreat + 0.5) {
                insights.push(`⚽ ${team1Name} has higher goal scoring potential (${team1GoalThreat.toFixed(2)} vs ${team2GoalThreat.toFixed(2)} goals/game)`);
            } else if (team2GoalThreat > team1GoalThreat + 0.5) {
                insights.push(`⚽ ${team2Name} has higher goal scoring potential (${team2GoalThreat.toFixed(2)} vs ${team1GoalThreat.toFixed(2)} goals/game)`);
            }
        }
        
        if (playerH2HStats.hasData && playerH2HStats.keyMatchups.length > 0) {
            insights.push(`📊 ${playerH2HStats.keyMatchups.length} key player matchup${playerH2HStats.keyMatchups.length > 1 ? 's' : ''} identified that could influence the result`);
        }
        
        const team1Exp = team1Stats.reduce((sum, p) => sum + p.games, 0);
        const team2Exp = team2Stats.reduce((sum, p) => sum + p.games, 0);
        
        if (Math.abs(team1Exp - team2Exp) > 50) {
            const moreExp = team1Exp > team2Exp ? team1Name : team2Name;
            const lessExp = team1Exp > team2Exp ? team2Name : team1Name;
            insights.push(`🎓 ${moreExp} has significantly more experience (${Math.max(team1Exp, team2Exp)} vs ${Math.min(team1Exp, team2Exp)} total games) - ${lessExp} may be at a disadvantage`);
        }
        
        return insights;
    }
    
    identifyKeyPlayers(team1Stats, team2Stats) {
        const allPlayers = [...team1Stats, ...team2Stats];
        const qualifiedPlayers = allPlayers.filter(p => p.games >= 5);
        
        return {
            topScorer: qualifiedPlayers.sort((a, b) => b.goals - a.goals)[0] || null,
            bestCreator: qualifiedPlayers.sort((a, b) => b.assists - a.assists)[0] || null,
            bestGoalsPerGame: qualifiedPlayers.sort((a, b) => b.goalsPerGame - a.goalsPerGame)[0] || null,
            bestAssistsPerGame: qualifiedPlayers.sort((a, b) => b.assistsPerGame - a.assistsPerGame)[0] || null,
            mostReliable: qualifiedPlayers.sort((a, b) => b.reliability - a.reliability)[0] || null,
            inForm: qualifiedPlayers.filter(p => p.formRating !== null).sort((a, b) => parseFloat(b.formRating) - parseFloat(a.formRating))[0] || null
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
            assistsPerGame: 0,
            formRating: null,
            reliability: 0.1,
            impactScore: null
        };
    }
    
    generateHTMLReport(analysis) {
        const team1 = analysis.team1;
        const team2 = analysis.team2;
        const pred = analysis.prediction;
        const h2h = analysis.playerHeadToHead;
        
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
                                <div class="stat">Team Form: <strong>${team1.metrics.formRating}%</strong> ${team1.metrics.formRating === "N/A" ? '<small class="text-muted">(insufficient data)</small>' : ''}</div>
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
                                <div class="stat">Team Form: <strong>${team2.metrics.formRating}%</strong> ${team2.metrics.formRating === "N/A" ? '<small class="text-muted">(insufficient data)</small>' : ''}</div>
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
                    <h4><i class="fas fa-history"></i> Player Head-to-Head Analysis</h4>
                    <div class="row text-center">
                        <div class="col-md-4">
                            <div class="h2h-stat"><strong>${h2h.totalMatchups}</strong> Player Matchups</div>
                        </div>
                        <div class="col-md-4">
                            <div class="h2h-stat text-primary"><strong>${team1.name}: ${h2h.team1WinRateVsOpponents}%</strong> Win Rate</div>
                        </div>
                        <div class="col-md-4">
                            <div class="h2h-stat text-danger"><strong>${team2.name}: ${h2h.team2WinRateVsOpponents}%</strong> Win Rate</div>
                        </div>
                    </div>
                    ${h2h.keyMatchups.length > 0 ? `
                    <div class="mt-3">
                        <strong>⚡ Key Individual Matchups:</strong>
                        <ul class="mt-2">
                            ${h2h.keyMatchups.slice(0, 3).map(m => `
                                <li><strong>${m.winner}</strong> dominates <strong>${m.loser}</strong> (${m.winRate}% win rate over ${m.games} games, scoring ${m.goalsPerGame} goals/game)</li>
                            `).join('')}
                        </ul>
                    </div>
                    ` : ''}
                </div>
                ` : '<div class="head-to-head text-muted">📊 Insufficient player head-to-head data for meaningful analysis (need 2+ games between players)</div>'}
                
                <div class="insights">
                    <h4><i class="fas fa-lightbulb"></i> Key Insights</h4>
                    <ul>
                        ${analysis.insights.map(i => `<li>${i}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="key-players">
                    <h4><i class="fas fa-star"></i> Key Players <small class="text-muted">(min 5 games)</small></h4>
                    <div class="row">
                        <div class="col-md-4">
                            <div class="player-highlight">
                                <i class="fas fa-futbol"></i> Top Scorer: <strong>${analysis.keyPlayers.topScorer?.name || 'N/A'}</strong>
                                <small>(${analysis.keyPlayers.topScorer?.goals || 0} goals)</small>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="player-highlight">
                                <i class="fas fa-handshake"></i> Best Creator: <strong>${analysis.keyPlayers.bestCreator?.name || 'N/A'}</strong>
                                <small>(${analysis.keyPlayers.bestCreator?.assists || 0} assists)</small>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="player-highlight">
                                <i class="fas fa-chart-line"></i> Best Goals/Game: <strong>${analysis.keyPlayers.bestGoalsPerGame?.name || 'N/A'}</strong>
                                <small>(${(analysis.keyPlayers.bestGoalsPerGame?.goalsPerGame || 0).toFixed(2)} per game)</small>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="player-highlight">
                                <i class="fas fa-chart-line"></i> Best Assists/Game: <strong>${analysis.keyPlayers.bestAssistsPerGame?.name || 'N/A'}</strong>
                                <small>(${(analysis.keyPlayers.bestAssistsPerGame?.assistsPerGame || 0).toFixed(2)} per game)</small>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="player-highlight">
                                <i class="fas fa-shield-alt"></i> Most Reliable: <strong>${analysis.keyPlayers.mostReliable?.name || 'N/A'}</strong>
                                <small>(${analysis.keyPlayers.mostReliable?.games || 0} games)</small>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="player-highlight">
                                <i class="fas fa-fire"></i> In Form: <strong>${analysis.keyPlayers.inForm?.name || 'N/A'}</strong>
                                <small>(${analysis.keyPlayers.inForm?.formRating || 0}% last ${analysis.keyPlayers.inForm?.formGames || 0} games)</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="player-stats mt-3">
                    <h4><i class="fas fa-users"></i> Player Breakdown</h4>
                    <div class="row">
                        <div class="col-md-6">
                            <h5>${team1.name}</h5>
                            ${team1.stats.sort((a,b) => (b.impactScore || 0) - (a.impactScore || 0)).map(p => `
                                <div class="player-stat">
                                    <strong>${p.name}</strong>
                                    <span class="badge bg-secondary float-end">${p.games} games</span>
                                    <div class="small">
                                        PPG: ${p.ppg} | ${p.games >= 5 ? `Impact: ${p.impactScore}` : '<span class="text-muted">Impact: N/A*</span>'} | 
                                        Form: ${p.formRating ? p.formRating + '%' : '<span class="text-muted">N/A*</span>'}
                                    </div>
                                    <div class="small text-muted">
                                        ${p.goals}G / ${p.assists}A (${(p.goalsPerGame || 0).toFixed(2)} G/g, ${(p.assistsPerGame || 0).toFixed(2)} A/g)
                                    </div>
                                    <div class="progress" style="height: 3px;">
                                        <div class="progress-bar bg-success" style="width: ${p.reliability * 100}%"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="col-md-6">
                            <h5>${team2.name}</h5>
                            ${team2.stats.sort((a,b) => (b.impactScore || 0) - (a.impactScore || 0)).map(p => `
                                <div class="player-stat">
                                    <strong>${p.name}</strong>
                                    <span class="badge bg-secondary float-end">${p.games} games</span>
                                    <div class="small">
                                        PPG: ${p.ppg} | ${p.games >= 5 ? `Impact: ${p.impactScore}` : '<span class="text-muted">Impact: N/A*</span>'} | 
                                        Form: ${p.formRating ? p.formRating + '%' : '<span class="text-muted">N/A*</span>'}
                                    </div>
                                    <div class="small text-muted">
                                        ${p.goals}G / ${p.assists}A (${(p.goalsPerGame || 0).toFixed(2)} G/g, ${(p.assistsPerGame || 0).toFixed(2)} A/g)
                                    </div>
                                    <div class="progress" style="height: 3px;">
                                        <div class="progress-bar bg-success" style="width: ${p.reliability * 100}%"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="mt-2 text-muted small">
                        <i class="fas fa-info-circle"></i> *Impact Score requires minimum 5 games | Form requires 3+ games in last 5
                    </div>
                </div>
            </div>
        `;
    }
}
