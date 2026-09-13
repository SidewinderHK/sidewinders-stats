// Application State
let rawMatchesData = [];

document.addEventListener('DOMContentLoaded', initApp);

/**
 * Main initialization flow. Ensures sequential execution:
 * Fetch Data -> Extract Seasons -> Set Default -> Render View.
 */
async function initApp() {
  try {
    const response = await fetch('data.csv');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const csvText = await response.text();
    rawMatchesData = parseCSV(csvText);

    if (!rawMatchesData || rawMatchesData.length === 0) {
      renderStatusMessage('No data available in CSV file.');
      return;
    }

    // Extract unique seasons (preserving original order or sorting descending)
    const seasons = [...new Set(rawMatchesData.map(item => item.Season).filter(Boolean))];

    if (seasons.length === 0) {
      renderStatusMessage('No valid seasons found in data.');
      return;
    }

    // Populate dropdown options
    const selectEl = document.getElementById('seasonSelect');
    selectEl.innerHTML = '';
    
    seasons.forEach(season => {
      const option = document.createElement('option');
      option.value = season;
      option.textContent = season;
      selectEl.appendChild(option);
    });

    // Attach event listener for manual changes
    selectEl.addEventListener('change', (e) => {
      renderSeasonData(e.target.value);
    });

    // FIRM FIX: Explicitly load the default (first/current) season on startup
    const currentSeason = seasons[0];
    selectEl.value = currentSeason;
    renderSeasonData(currentSeason);

  } catch (error) {
    console.error('Initialization failed:', error);
    renderStatusMessage('Error loading match data. Please check the console or CSV file path.');
  }
}

/**
 * Filters dataset and updates the table UI for the selected season.
 */
function renderSeasonData(season) {
  const tbody = document.getElementById('tableBody');
  const filteredData = rawMatchesData.filter(row => row.Season === season);

  if (filteredData.length === 0) {
    renderStatusMessage('No data available for this season.');
    return;
  }

  tbody.innerHTML = '';
  filteredData.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHTML(row.Date || '-')}</td>
      <td>${escapeHTML(row.Opponent || '-')}</td>
      <td><span class="badge ${getBadgeClass(row.Result)}">${escapeHTML(row.Result || '-')}</span></td>
      <td>${escapeHTML(row.Score || '-')}</td>
      <td>${escapeHTML(row.Goals || '0')}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Robust CSV parser supporting quoted strings and commas inside cells.
 */
function parseCSV(text) {
  const lines = text.trim().split(/\r\n|\n/);
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]);
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = splitCSVLine(lines[i]);
    const entry = {};
    
    headers.forEach((header, index) => {
      entry[header.trim()] = values[index] ? values[index].trim() : '';
    });
    
    results.push(entry);
  }

  return results;
}

function splitCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function renderStatusMessage(message) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = `<tr><td colspan="5" class="status-msg">${escapeHTML(message)}</td></tr>`;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getBadgeClass(result) {
  if (!result) return '';
  const res = result.toUpperCase();
  if (res.startsWith('W')) return 'badge-win';
  if (res.startsWith('L')) return 'badge-loss';
  if (res.startsWith('D')) return 'badge-draw';
  return '';
}