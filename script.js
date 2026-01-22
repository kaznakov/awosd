// ========== VATSIM AWOSD v1.1.0 - COMPLETE WORKING FILE ==========
// Fixed: wind direction "?", calm wind arrow, VRB handling, trend arrows, trend colors

// ========== GLOBAL VARIABLES ==========
let currentMetarData = null;
let previousMetarData = null;
let currentRunwayData = null;
let updateInterval = null;
let globalAPI = null;
let userPreferredWindUnit = null;

const DOM = {
    icaoInput: null, runwaySelect: null, runwayDisplay2: null, theme: null, language: null, courseType: null,
    currentTime: null, sunrise: null, sunset: null, timeLabel: null, sunriseLabel: null, sunsetLabel: null,
    qnhHpa: null, qnhMmhg: null, qnhInhg: null, tempValue: null, dewValue: null, morValue: null, qbbValue: null,
    weatherPhenomena: null, cloudinessValue: null, specialConditions: null,
    compass1: null, compass2: null, compassInfo1: null, compassInfo2: null,
    metarCode: null, forecastValue: null, connectionStatus: null, csvLoading: null
};

function initDOMCache() {
    DOM.icaoInput = document.getElementById('icaoInput');
    DOM.runwaySelect = document.getElementById('runwaySelect');
    DOM.runwayDisplay2 = document.getElementById('runwayDisplay2');
    DOM.theme = document.getElementById('theme');
    DOM.language = document.getElementById('language');
    DOM.courseType = document.getElementById('courseType');
    DOM.currentTime = document.getElementById('currentTime');
    DOM.sunrise = document.getElementById('sunrise');
    DOM.sunset = document.getElementById('sunset');
    DOM.timeLabel = document.getElementById('timeLabel');
    DOM.sunriseLabel = document.getElementById('sunriseLabel');
    DOM.sunsetLabel = document.getElementById('sunsetLabel');
    DOM.qnhHpa = document.getElementById('qnhHpa');
    DOM.qnhMmhg = document.getElementById('qnhMmhg');
    DOM.qnhInhg = document.getElementById('qnhInhg');
    DOM.tempValue = document.getElementById('tempValue');
    DOM.dewValue = document.getElementById('dewValue');
    DOM.morValue = document.getElementById('morValue');
    DOM.qbbValue = document.getElementById('qbbValue');
    DOM.weatherPhenomena = document.getElementById('weatherPhenomena');
    DOM.cloudinessValue = document.getElementById('cloudinessValue');
    DOM.specialConditions = document.getElementById('specialConditions');
    DOM.compass1 = document.getElementById('compass');
    DOM.compass2 = document.getElementById('compass2');
    DOM.compassInfo1 = document.getElementById('compassInfo1');
    DOM.compassInfo2 = document.getElementById('compassInfo2');
    DOM.metarCode = document.getElementById('metarCode');
    DOM.forecastValue = document.getElementById('forecastValue');
    DOM.connectionStatus = document.getElementById('connectionStatus');
    DOM.csvLoading = document.getElementById('csvLoading');
}

// ========== TREND SYSTEM ==========
class TrendManager {
    constructor() {
        this.previousValues = {qnh: null, temp: null, dew: null, windSpeed: null, windGust: null, mor: null, qbb: null, rvr1: null, rvr2: null, qfe1: null, qfe2: null};
    }
    updateTrend(current, previous, threshold = 0) {
        if (previous === null || previous === undefined || current === null || current === undefined) return null;
        const diff = current - previous;
        if (Math.abs(diff) <= threshold) return null;
        return diff > 0 ? 'up' : 'down';
    }
    getTrendHTML(trend) {
        if (!trend) return '';
        return `<span class="trend-indicator ${trend}">${trend === 'up' ? '↑' : '↓'}</span>`;
    }
    updateValue(key, value) { this.previousValues[key] = value; }
    getValue(key) { return this.previousValues[key]; }
}
const trendManager = new TrendManager();

// ========== UTILITIES ==========
function convertPressure(hpa) {
    return {hpa: Math.round(hpa), mmhg: Math.round(hpa * 0.750062), inhg: (hpa * 0.02953).toFixed(2)};
}

function updateConnectionStatus(status, text) {
    if (!DOM.connectionStatus) return;
    DOM.connectionStatus.className = `connection-status ${status}`;
    DOM.connectionStatus.querySelector('span').textContent = text;
}

async function getAPI() {
    if (!globalAPI) {
        globalAPI = new OurAirportsAPI();
        await globalAPI.loadDatabase();
    }
    return globalAPI;
}

// ========== OURAIRPORTS API ==========
class OurAirportsAPI {
    constructor() {
        this.airports = new Map();
        this.loaded = false;
        this.loadingPromise = null;
    }

    async loadDatabase() {
        if (this.loaded) return true;
        if (this.loadingPromise) return this.loadingPromise;
        console.log('Loading local data...');
        this.showCSVLoading(true);
        updateConnectionStatus('loading', 'Loading local data...');
        this.loadingPromise = this._loadLocalCSVFiles();
        return this.loadingPromise;
    }

    async _loadLocalCSVFiles() {
        try {
            const [airportsResponse, runwaysResponse] = await Promise.all([
                fetch('./airports.csv'),
                fetch('./runways.csv')
            ]);

            if (!airportsResponse.ok || !runwaysResponse.ok) {
                throw new Error('Cannot load CSV files');
            }

            const airportsData = await airportsResponse.text();
            const runwaysData = await runwaysResponse.text();

            await this._parseCSVData(airportsData, runwaysData);

            this.loaded = true;
            this.showCSVLoading(false);

            const stats = {
                airports: this.airports.size,
                totalRunways: Array.from(this.airports.values()).reduce((sum, airport) => sum + airport.runways.length, 0)
            };

            console.log('Loaded ' + stats.airports + ' airports with ' + stats.totalRunways + ' runways');
            updateConnectionStatus('connected', `${stats.airports} airports loaded`);
            return true;
        } catch (error) {
            console.error('Failed to load CSV files:', error);
            this.showCSVLoading(false);
            updateConnectionStatus('error', 'CSV files required');
            throw new Error('CSV files are required');
        }
    }

    async _parseCSVData(airportsCSV, runwaysCSV) {
        const parseCSV = (text) => {
            const lines = text.split('\n');
            const headers = this._parseCSVLine(lines[0]);
            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const values = this._parseCSVLine(line);
                if (values.length >= headers.length) {
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index] || '';
                    });
                    data.push(row);
                }
            }
            return data;
        };

        const airportsData = parseCSV(airportsCSV);

        for (const row of airportsData) {
            const icao = row.ident;
            if (!icao || icao.length !== 4 || !icao.match(/^[A-Z0-9]{4}$/)) continue;
            if (row.type === 'closed') continue;

            this.airports.set(icao, {
                icao: icao,
                name: row.name || 'Unknown Airport',
                type: row.type || 'unknown',
                elevation_ft: parseFloat(row.elevation_ft) || 0,
                latitude: parseFloat(row.latitude_deg) || 0,
                longitude: parseFloat(row.longitude_deg) || 0,
                country: row.iso_country || '',
                iso_country: row.iso_country || '',
                iso_region: row.iso_region || '',
                municipality: row.municipality || '',
                continent: row.continent || '',
                runways: []
            });
        }

        const runwaysData = parseCSV(runwaysCSV);

        for (const row of runwaysData) {
            const icao = row.airport_ident;
            if (!this.airports.has(icao)) continue;
            if (row.closed === '1') continue;

            const runway = {
                le_ident: row.le_ident || '',
                he_ident: row.he_ident || '',
                le_elevation_ft: parseFloat(row.le_elevation_ft) || 0,
                he_elevation_ft: parseFloat(row.he_elevation_ft) || 0,
                le_heading_deg: parseFloat(row.le_heading_degT) || 0,
                he_heading_deg: parseFloat(row.he_heading_degT) || 180,
                length_ft: parseFloat(row.length_ft) || 0,
                width_ft: parseFloat(row.width_ft) || 0,
                surface: row.surface || 'ASP'
            };

            this.airports.get(icao).runways.push(runway);
        }

        const airportsWithRunways = new Map();
        for (const [icao, airport] of this.airports) {
            if (airport.runways && airport.runways.length > 0) {
                airportsWithRunways.set(icao, airport);
            }
        }
        this.airports = airportsWithRunways;
    }

    _parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result.map(val => val.replace(/^"|"$/g, ''));
    }

    showCSVLoading(show) {
        if (DOM.csvLoading) {
            DOM.csvLoading.className = show ? 'csv-loading show' : 'csv-loading';
        }
    }

    async getRunwayData(icao) {
        await this.loadDatabase();
        const airport = this.airports.get(icao.toUpperCase());

        if (!airport || !airport.runways || airport.runways.length === 0) {
            throw new Error(`No runway data for ${icao}`);
        }

        return airport.runways.map(runway => ({
            leIdent: runway.le_ident,
            heIdent: runway.he_ident,
            leElevation: runway.le_elevation_ft * 0.3048,
            heElevation: runway.he_elevation_ft * 0.3048,
            leHeading: runway.le_heading_deg,
            heHeading: runway.he_heading_deg,
            length: runway.length_ft * 0.3048,
            width: runway.width_ft * 0.3048,
            surface: runway.surface
        }));
    }

    getRunwayElevation(runwayData, selectedRunway) {
        for (const runway of runwayData) {
            if (runway.leIdent === selectedRunway) return runway.leElevation;
            if (runway.heIdent === selectedRunway) return runway.heElevation;
        }
        return null;
    }

    calculateQFE(qnhHpa, elevationMeters) {
        if (!qnhHpa || elevationMeters === null) return null;
        return Math.round(qnhHpa - (elevationMeters / 8.5));
    }

    getAirportInfo(icao) {
        const airport = this.airports.get(icao.toUpperCase());
        if (!airport) return null;

        return {
            icao: airport.icao,
            name: airport.name,
            latitude: airport.latitude,
            longitude: airport.longitude,
            country: airport.country,
            iso_region: airport.iso_region,
            municipality: airport.municipality,
            continent: airport.continent,
            elevation_ft: airport.elevation_ft
        };
    }
}

// ========== METAR PARSER ==========
function parseMetar(metarString) {
    if (!metarString) return null;

    const parts = metarString.split(' ');
    const data = {
        raw: metarString,
        icao: parts[0],
        time: '',
        wind: {
            direction: 0,
            speed: 0,
            gust: 0,
            variable: false,
            calm: false,
            vrb: false
        },
        windUnit: 'kt',
        visibility: 0,
        weather: [],
        clouds: [],
        temperature: null,
        dewpoint: null,
        pressure: 0,
        runwayStates: [],
        rvrData: []
    };

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        // Vremya
        if (part.match(/^\d{6}Z$/)) {
            data.time = part;
        }

        // VRB veter (variable wind) - узлы
        if (part.match(/^VRB\d{2}(G\d{2})?KT$/)) {
            data.wind.vrb = true;
            data.wind.direction = 0;
            data.wind.speed = parseInt(part.substring(3, 5));
            data.windUnit = 'kt';
            const gustMatch = part.match(/G(\d{2})/);
            data.wind.gust = gustMatch ? parseInt(gustMatch[1]) : 0;
        }

        // VRB veter (variable wind) - м/с
        if (part.match(/^VRB\d{2}(G\d{2})?MPS$/)) {
            data.wind.vrb = true;
            data.wind.direction = 0;
            data.wind.speed = parseInt(part.substring(3, 5));
            data.windUnit = 'm/s';
            const gustMatch = part.match(/G(\d{2})/);
            data.wind.gust = gustMatch ? parseInt(gustMatch[1]) : 0;
        }

        // Veter v uzlax
        if (part.match(/^\d{3}\d{2}(G\d{2})?KT$/)) {
            data.wind.direction = parseInt(part.substring(0, 3));
            data.wind.speed = parseInt(part.substring(3, 5));
            data.windUnit = 'kt';
            const gustMatch = part.match(/G(\d{2})/);
            data.wind.gust = gustMatch ? parseInt(gustMatch[1]) : 0;
        }

        // Veter v m/s
        if (part.match(/^\d{3}\d{2}(G\d{2})?MPS$/)) {
            data.wind.direction = parseInt(part.substring(0, 3));
            data.wind.speed = parseInt(part.substring(3, 5));
            data.windUnit = 'm/s';
            const gustMatch = part.match(/G(\d{2})/);
            data.wind.gust = gustMatch ? parseInt(gustMatch[1]) : 0;
        }

        // SHtil`
        if (part === '00000KT' || part === '00000MPS') {
            data.wind.calm = true;
            data.wind.direction = 0;
            data.wind.speed = 0;
        }

        // Peremenny`j veter (направление меняется)
        if (part.match(/^\d{3}V\d{3}$/)) {
            data.wind.variable = true;
            const winds = part.split('V');
            data.variableFrom = parseInt(winds[0]);
            data.variableTo = parseInt(winds[1]);
        }

        // Vidimost`
        if (part.match(/^\d{4}$/) && parseInt(part) > 100) {
            data.visibility = parseInt(part);
        }

        // Temperatura/tochka rosy`
        if (part.match(/^M?\d{2}\/M?\d{2}$/)) {
            const temps = part.split('/');
            data.temperature = parseInt(temps[0].replace('M', '-'));
            data.dewpoint = parseInt(temps[1].replace('M', '-'));
        }

        // Davlenie QNH
        if (part.match(/^Q\d{4}$/)) {
            data.pressure = parseInt(part.substring(1));
        }

        // Oblachnost`
        if (part.match(/^(SKC|CLR|FEW|SCT|BKN|OVC|NSC|NCD)\d{0,3}(CB|TCU)?$/)) {
            const coverage = part.match(/^(SKC|CLR|FEW|SCT|BKN|OVC|NSC|NCD)/)[1];
            const heightMatch = part.match(/\d{3}/);
            const height = heightMatch ? parseInt(heightMatch[0]) * 100 : null;
            const typeMatch = part.match(/(CB|TCU)$/);
            const type = typeMatch ? typeMatch[1] : null;
            data.clouds.push({coverage, height, type});
        }

        // Pogodny`e yavleniya
        if (part.match(/^(\+|-|VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP)?(BR|FG|FU|VA|DU|SA|HZ|PY)?(PO|SQ|FC|SS|DS)?$/)) {
            if (!part.match(/^(SKC|CLR|FEW|SCT|BKN|OVC|NSC|NCD|CAVOK|NOSIG|TEMPO|BECMG|RMK|Q\d{4}|R\d{2})/)) {
                data.weather.push(part);
            }
        }

        // RVR
        if (part.match(/^R\d{2}[LRC]?\/[PM]?\d{4}(V[PM]?\d{4})?$/)) {
            const rvrMatch = part.match(/^R(\d{2}[LRC]?)\/(P|M)?(\d{4})(V(P|M)?(\d{4}))?$/);
            if (rvrMatch) {
                data.rvrData.push({
                    raw: part,
                    runway: rvrMatch[1],
                    value: parseInt(rvrMatch[3]),
                    prefix: rvrMatch[2] || '',
                    valueMax: rvrMatch[4] ? parseInt(rvrMatch[6]) : null,
                    prefixMax: rvrMatch[5] || '',
                    isVariable: !!rvrMatch[4]
                });
            }
        }

        // Sostoyanie VPP
        if (part.match(/^(R)?\d{2}[LRC]?\/\d{6}$/) || part.match(/^88\/\d{6}$/)) {
            const runwayStateMatch = part.match(/^R?(\d{2}[LRC]?|88)\/(\d)(\d)(\d{2})(\d{2})$/);
            if (runwayStateMatch) {
                data.runwayStates.push({
                    raw: part,
                    runway: runwayStateMatch[1],
                    deposit: runwayStateMatch[2],
                    extent: runwayStateMatch[3],
                    depth: runwayStateMatch[4],
                    friction: runwayStateMatch[5]
                });
            }
        }
    }

    // Razbor RMK sekczii
    const remarksSection = extractRemarksSection(metarString);
    if (remarksSection) {
        const currentLang = DOM.language?.value || 'en';
        data.specialConditions = parseSpecialConditionsFromRemarks(remarksSection, currentLang);
    } else {
        data.specialConditions = {qfe: null, qbb: null, other: []};
    }

    return data;
}

function extractRemarksSection(metarString) {
    if (!metarString) return '';

    const rmkIndex = metarString.indexOf(' RMK ');
    if (rmkIndex === -1) return '';

    let remarksSection = metarString.substring(rmkIndex + 5);
    remarksSection = remarksSection.replace(/\s*TEMPO\s+.*$/i, '');
    remarksSection = remarksSection.replace(/\s*BECMG\s+.*$/i, '');
    remarksSection = remarksSection.replace(/\s*PROB\d{2}\s+.*$/i, '');
    remarksSection = remarksSection.replace(/\s*=\s*$/, '');

    return remarksSection.trim();
}

function parseSpecialConditionsFromRemarks(remarksString, language = 'ru') {
    if (!remarksString || remarksString.trim() === '') {
        return {qfe: null, qbb: null, other: []};
    }

    const result = {qfe: null, qbb: null, other: []};
    const parts = remarksString.split(/\s+/);

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        // QFE
        if (part.match(/^QFE/i)) {
            const qfeFormatSlash = part.match(/^QFE(\d{3,4})\/0?(\d{3,4})$/i);
            if (qfeFormatSlash) {
                result.qfe = parseInt(qfeFormatSlash[2]);
            } else {
                const qfeFormatSimple = part.match(/^QFE(\d{3,4})$/i);
                if (qfeFormatSimple) {
                    const value = parseInt(qfeFormatSimple[1]);
                    result.qfe = (value >= 600 && value < 800) ? Math.round(value / 0.750062) : value;
                }
            }
        }

        // QBB
        else if (part.match(/^QBB\d{3,4}$/i)) {
            const qbbMatch = part.match(/^QBB(\d{3,4})$/i);
            if (qbbMatch) {
                result.qbb = parseInt(qbbMatch[1]);
            }
        }
    }

    return result;
}

async function fetchMetarHistory(icao, hours = 1) {
    const originalUrl = `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json&hours=${hours}`;
    const corsProxies = [
        'https://api.allorigins.win/raw?url=',
        'https://corsproxy.io/?'
    ];

    for (let i = 0; i < corsProxies.length; i++) {
        const url = corsProxies[i] + encodeURIComponent(originalUrl);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            if (!data || data.length === 0) return [];

            return data.sort((a, b) => new Date(a.obsTime) - new Date(b.obsTime));
        } catch (error) {
            if (i === corsProxies.length - 1) return [];
            continue;
        }
    }

    return [];
}

function convertApiMetarToAppFormat(apiMetar) {
    if (!apiMetar) return null;

    const parsed = parseMetar(apiMetar.rawOb);

    if (parsed.wind && apiMetar.wspd !== undefined) {
        let windSpeed = apiMetar.wspd;
        let windGust = apiMetar.wgst || 0;

        if (parsed.windUnit === 'm/s') {
            windSpeed = Math.round(windSpeed / 1.944);
            windGust = windGust > 0 ? Math.round(windGust / 1.944) : 0;
        }

        parsed.wind.speed = windSpeed;
        parsed.wind.direction = apiMetar.wdir || 0;
        parsed.wind.gust = windGust;
        parsed.wind.calm = windSpeed === 0;
    }

    return parsed;
}

function saveMetarToLocalHistory(icao, metarData) {
    try {
        const key = `metar_history_${icao}`;
        let history = [];

        const stored = localStorage.getItem(key);
        if (stored) {
            history = JSON.parse(stored);
        }

        history.push({
            timestamp: new Date().toISOString(),
            data: metarData
        });

        if (history.length > 10) {
            history = history.slice(-10);
        }

        localStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
        console.warn('? localStorage error:', e);
    }
}

function getPreviousMetarFromLocalHistory(icao) {
    try {
        const stored = localStorage.getItem(`metar_history_${icao}`);
        if (!stored) return null;

        const history = JSON.parse(stored);
        if (history.length < 2) return null;

        return history[history.length - 2].data;
    } catch (e) {
        console.warn('? localStorage error:', e);
        return null;
    }
}

async function loadMetarWithHistory(icao) {
    console.log('📥 Loading METAR history for', icao);
    try {
        const apiHistory = await fetchMetarHistory(icao, 2); // Увеличено до 2 часов

        if (apiHistory.length >= 2) {
            currentMetarData = convertApiMetarToAppFormat(apiHistory[apiHistory.length - 1]);
            previousMetarData = convertApiMetarToAppFormat(apiHistory[apiHistory.length - 2]);
            saveMetarToLocalHistory(icao, currentMetarData);
            console.log('✅ Loaded 2 METARs from API:', {
                current: currentMetarData.time,
                previous: previousMetarData.time
            });
            return currentMetarData;
        } else if (apiHistory.length === 1) {
            currentMetarData = convertApiMetarToAppFormat(apiHistory[0]);
            previousMetarData = getPreviousMetarFromLocalHistory(icao);
            saveMetarToLocalHistory(icao, currentMetarData);
            console.log('⚠️ Only 1 METAR from API, checking localStorage:', {
                current: currentMetarData.time,
                previous: previousMetarData ? 'found' : 'not found'
            });
            return currentMetarData;
        }
    } catch (error) {
        console.warn('⚠️ API unavailable:', error.message);
    }

    // Если API недоступен - используем fallback
    previousMetarData = getPreviousMetarFromLocalHistory(icao);
    currentMetarData = await fetchMetarData(icao);
    saveMetarToLocalHistory(icao, currentMetarData);
    console.log('ℹ️ Fallback mode:', {
        current: 'loaded',
        previous: previousMetarData ? 'from localStorage' : 'not available'
    });
    return currentMetarData;
}

async function fetchMetarData(icao) {
    updateConnectionStatus('loading', 'Loading METAR...');

    try {
        const response = await fetch(`https://metar.vatsim.net/${icao.toUpperCase()}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const metarText = await response.text();

        if (!metarText || metarText.includes('No METAR available')) {
            throw new Error('No METAR data');
        }

        const parsedData = parseMetar(metarText.trim());

        if (parsedData) {
            updateConnectionStatus('connected', 'METAR loaded');
            return parsedData;
        } else {
            throw new Error('Failed to parse METAR');
        }
    } catch (error) {
        console.error('METAR error:', error);
        updateConnectionStatus('error', 'METAR error');
        return generateDemoData(icao);
    }
}

function generateDemoData(icao) {
    return {
        raw: `${icao} NO METAR`,
        icao: icao,
        time: '121853Z',
        wind: {
            direction: 190,
            speed: 5,
            gust: 0,
            variable: false,
            calm: false,
            vrb: false
        },
        windUnit: 'kt',
        visibility: 9999,
        weather: [],
        clouds: [
            {coverage: 'FEW', height: 2000},
            {coverage: 'SCT', height: 8000}
        ],
        temperature: 12,
        dewpoint: 8,
        pressure: 1013,
        rvrData: [],
        runwayStates: [],
        specialConditions: {qfe: null, qbb: null, other: []}
    };
}

// ========== KOMPAS - OTRISOVKA ==========
function drawCompass(compassId) {
    const compass = document.getElementById(compassId);
    if (!compass) return;

    compass.innerHTML = '';

    const rect = compass.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const radius = size / 2;
    const cx = size / 2;
    const cy = size / 2;

    for (let i = 0; i < 36; i++) {
        const angle = i * 10;
        const radian = (angle - 90) * Math.PI / 180;
        const isMajor = i % 3 === 0;

        const mark = document.createElement('div');
        mark.className = isMajor ? 'compass-mark major' : 'compass-mark minor';

        const markLength = isMajor ? 18 : 12;
        const markWidth = isMajor ? 2 : 1;
        const compassCircleRadius = radius - 2;

        const outerX = cx + Math.cos(radian) * compassCircleRadius;
        const outerY = cy + Math.sin(radian) * compassCircleRadius;
        const innerX = cx + Math.cos(radian) * (compassCircleRadius - markLength);
        const innerY = cy + Math.sin(radian) * (compassCircleRadius - markLength);

        const centerMarkX = (outerX + innerX) / 2;
        const centerMarkY = (outerY + innerY) / 2;

        mark.style.left = (centerMarkX - markWidth / 2) + 'px';
        mark.style.top = (centerMarkY - markLength / 2) + 'px';
        mark.style.width = markWidth + 'px';
        mark.style.height = markLength + 'px';
        mark.style.transform = `rotate(${angle}deg)`;
        mark.style.transformOrigin = 'center';

        compass.appendChild(mark);

        if (angle % 30 === 0) {
            const number = document.createElement('div');
            number.className = 'compass-number';
            const labels = ['36','03','06','09','12','15','18','21','24','27','30','33'];
            number.textContent = labels[i/3];

            const numberRadius = compassCircleRadius + 18;
            const nx = cx + Math.cos(radian) * numberRadius;
            const ny = cy + Math.sin(radian) * numberRadius;

            number.style.left = (nx - 12) + 'px';
            number.style.top = (ny - 8) + 'px';

            compass.appendChild(number);
        }
    }
}

function addRunwayToCompass(compassId, runwayHeading) {
    const compass = document.getElementById(compassId);
    if (!compass) return;

    const runway = document.createElement('div');
    runway.className = 'runway-display left-landing';
    runway.style.transform = `translate(-50%,-50%) rotate(${runwayHeading - 90}deg)`;
    compass.appendChild(runway);
}

function addWindToCompass(compassId) {
    if (!currentMetarData) return;

    const compass = document.getElementById(compassId);
    if (!compass) return;

    const container = compass.parentElement;

    compass.querySelectorAll('.wind-arrow, .wind-sector').forEach(el => el.remove());

    const windDisplay = container.querySelector('.wind-display');
    if (windDisplay) {
        const windDir = currentMetarData.wind.calm ? 0 : currentMetarData.wind.direction;
        let windSpeed = currentMetarData.wind.calm ? 0 : currentMetarData.wind.speed;
        let windGust = currentMetarData.wind.gust || 0;
        let windUnit = currentMetarData.windUnit || 'kt';

        if (userPreferredWindUnit && userPreferredWindUnit !== windUnit) {
            if (userPreferredWindUnit === 'kt' && windUnit === 'm/s') {
                windSpeed = Math.round(windSpeed * 1.944);
                windGust = windGust > 0 ? Math.round(windGust * 1.944) : 0;
                windUnit = 'kt';
            } else if (userPreferredWindUnit === 'm/s' && windUnit === 'kt') {
                windSpeed = Math.round(windSpeed / 1.944);
                windGust = windGust > 0 ? Math.round(windGust / 1.944) : 0;
                windUnit = 'm/s';
            }
        }

        const currentLang = DOM.language?.value || 'en';

        // Штиль - показываем Calm/Тихо
        if (currentMetarData.wind.calm || windSpeed === 0) {
            windDisplay.querySelector('.wind-direction').textContent = currentLang === 'ru' ? 'Тихо' : 'Calm';
            windDisplay.querySelector('.wind-speed').textContent = '';
            windDisplay.querySelector('.wind-unit').textContent = '';
            return;
        }

        // VRB ветер - показываем VRB вместо направления
        if (currentMetarData.wind.vrb) {
            windDisplay.querySelector('.wind-direction').textContent = 'VRB';
        } else {
            windDisplay.querySelector('.wind-direction').textContent = `${windDir.toString().padStart(3,'0')}°`;
        }

        const windSpeedElement = windDisplay.querySelector('.wind-speed');
        const windTrend = getWindTrend();
        const gustTrend = getGustTrend();

        if (windGust > 0 && windGust > windSpeed) {
            const gustText = currentLang === 'ru' ? 'порывы' : 'gusts';
            let html = `${windSpeed}`;
            if (windTrend) html += ` ${trendManager.getTrendHTML(windTrend)}`;
            html += ` <span style="font-size:0.7em">${gustText}</span> ${windGust}`;
            if (gustTrend) html += ` ${trendManager.getTrendHTML(gustTrend)}`;
            windSpeedElement.innerHTML = html;
        } else {
            windSpeedElement.innerHTML = windTrend ? `${windSpeed} ${trendManager.getTrendHTML(windTrend)}` : windSpeed.toString();
        }

        windDisplay.querySelector('.wind-unit').textContent = windUnit;
    }

    // Не рисуем стрелку при штиле или VRB ветре - ПРОВЕРКА ПЕРЕД ВСЕМ ОСТАЛЬНЫМ
    if (currentMetarData.wind.calm || currentMetarData.wind.speed === 0 || currentMetarData.wind.vrb) {
        console.log('⚠️ No arrow: calm=' + currentMetarData.wind.calm + ', vrb=' + currentMetarData.wind.vrb);
        return;
    }

    if (currentMetarData.wind.variable && currentMetarData.variableFrom !== undefined && currentMetarData.variableTo !== undefined) {
        const sector = document.createElement('div');
        sector.className = 'wind-sector variable';

        const rect = compass.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height);
        const radius = size / 2;
        const cx = size / 2;
        const cy = size / 2;

        const fromAngle = currentMetarData.variableFrom;
        const toAngle = currentMetarData.variableTo;

        let arcSpan = toAngle - fromAngle;
        if (arcSpan < 0) arcSpan += 360;

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none";

        const arcRadius = radius * 0.9;
        const startAngleRad = (fromAngle - 90) * Math.PI / 180;
        const endAngleRad = (toAngle - 90) * Math.PI / 180;

        const startX = cx + arcRadius * Math.cos(startAngleRad);
        const startY = cy + arcRadius * Math.sin(startAngleRad);
        const endX = cx + arcRadius * Math.cos(endAngleRad);
        const endY = cy + arcRadius * Math.sin(endAngleRad);

        const path = document.createElementNS(svgNS, "path");
        const largeArcFlag = arcSpan > 180 ? 1 : 0;
        path.setAttribute("d", `M ${startX} ${startY} A ${arcRadius} ${arcRadius} 0 ${largeArcFlag} 1 ${endX} ${endY}`);
        path.setAttribute("stroke", "#4A90E2");
        path.setAttribute("stroke-width", "8");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("opacity", "0.7");

        svg.appendChild(path);
        sector.appendChild(svg);
        sector.style.cssText = "border:none;background:none;width:100%;height:100%";
        compass.appendChild(sector);
    }

    const arrow = document.createElement('div');
    arrow.className = 'wind-arrow';

    const rect = compass.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const radius = size / 2;
    const cx = size / 2;
    const cy = size / 2;

    const windAngle = currentMetarData.wind.direction;
    const windRad = (windAngle - 90) * Math.PI / 180;
    const compassCircleRadius = radius - 2;
    const arrowStartRadius = compassCircleRadius - 15;

    const startX = cx + Math.cos(windRad) * arrowStartRadius;
    const startY = cy + Math.sin(windRad) * arrowStartRadius;

    arrow.style.left = startX + 'px';
    arrow.style.top = startY + 'px';
    arrow.style.transform = `rotate(${windAngle}deg)`;

    compass.appendChild(arrow);
}

function initializeCompass(compassId) {
    drawCompass(compassId);

    if (currentRunwayData) {
        let runwayHeading;
        if (compassId === 'compass') {
            const selectedRunway = DOM.runwaySelect?.value;
            runwayHeading = selectedRunway ? getRunwayHeading(selectedRunway) : 0;
        } else {
            const oppositeRunway = DOM.runwayDisplay2?.textContent;
            runwayHeading = (oppositeRunway && oppositeRunway !== '--') ? getRunwayHeading(oppositeRunway) : 0;
        }
        addRunwayToCompass(compassId, runwayHeading);
    }

    addWindToCompass(compassId);
}

function initializeDefaultCompassInfo(compassInfoElement) {
    if (!compassInfoElement) return;

    compassInfoElement.innerHTML = `
        <div class="rvr-row compass-info-item">
            <div class="section-label">RVR</div><div class="data-field">-</div><div class="units">m</div>
        </div>
        <div class="elev-row compass-info-item">
            <div class="section-label">ELEV</div><div class="data-field">-</div><div class="units">m</div>
        </div>
        <div class="qfe-row"><div class="qfe-fields">
            <div class="qfe-field primary">
                <div class="qfe-label">QFE</div><div class="data-field">-</div><div class="units">hPa</div>
            </div>
            <div class="qfe-field secondary">
                <div class="qfe-label" style="visibility:hidden">QFE</div><div class="data-field">-</div><div class="units">mmHg</div>
            </div>
            <div class="qfe-field secondary">
                <div class="qfe-label" style="visibility:hidden">QFE</div><div class="data-field">-</div><div class="units">inHg</div>
            </div>
        </div></div>
        <div class="runway-state-row">
            <div class="runway-state-item surface">
                <div class="state-label">RWY</div><div class="state-value">-</div>
            </div>
            <div class="runway-state-item contamination">
                <div class="state-label" style="visibility:hidden">RWY</div><div class="state-value">-</div>
            </div>
            <div class="runway-state-item depth">
                <div class="state-label" style="visibility:hidden">RWY</div><div class="state-value">-</div>
            </div>
        </div>`;
}

function calculateWindComponents(windDir, windSpeed, runwayHeading) {
    const windAngleRad = (windDir - runwayHeading) * Math.PI / 180;
    return {
        headwind: Math.round(windSpeed * Math.cos(windAngleRad) * 10) / 10,
        crosswind: Math.round(windSpeed * Math.sin(windAngleRad) * 10) / 10
    };
}

function updateWindComponents() {
    if (!currentMetarData || !currentRunwayData) return;

    // При штиле или VRB ветре показываем прочерки
    if (currentMetarData.wind.calm || currentMetarData.wind.speed === 0 || currentMetarData.wind.vrb) {
        const compassContainer1 = DOM.compass1.parentElement;
        const lateral1 = compassContainer1.querySelector('.lateral-component .data-value');
        const headwind1 = compassContainer1.querySelector('.headwind-component .data-value');
        if (lateral1) lateral1.textContent = '-';
        if (headwind1) headwind1.textContent = '-';

        const compassContainer2 = DOM.compass2.parentElement;
        const lateral2 = compassContainer2.querySelector('.lateral-component .data-value');
        const headwind2 = compassContainer2.querySelector('.headwind-component .data-value');
        if (lateral2) lateral2.textContent = '-';
        if (headwind2) headwind2.textContent = '-';

        return;
    }

    const windDir = currentMetarData.wind.direction;
    const windSpeed = currentMetarData.wind.speed;

    const selectedRunway1 = DOM.runwaySelect.value;
    if (selectedRunway1) {
        const runwayHeading = getRunwayHeading(selectedRunway1);
        const components1 = calculateWindComponents(windDir, windSpeed, runwayHeading);

        const compassContainer1 = DOM.compass1.parentElement;
        const lateral1 = compassContainer1.querySelector('.lateral-component .data-value');
        const headwind1 = compassContainer1.querySelector('.headwind-component .data-value');

        if (lateral1) {
            const value = components1.crosswind;
            lateral1.textContent = value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
        }
        if (headwind1) {
            const value = components1.headwind;
            headwind1.textContent = value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
        }
    }

    const selectedRunway2 = DOM.runwayDisplay2.textContent;
    if (selectedRunway2 && selectedRunway2 !== '--') {
        const runwayHeading = getRunwayHeading(selectedRunway2);
        const components2 = calculateWindComponents(windDir, windSpeed, runwayHeading);

        const compassContainer2 = DOM.compass2.parentElement;
        const lateral2 = compassContainer2.querySelector('.lateral-component .data-value');
        const headwind2 = compassContainer2.querySelector('.headwind-component .data-value');

        if (lateral2) {
            const value = components2.crosswind;
            lateral2.textContent = value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
        }
        if (headwind2) {
            const value = components2.headwind;
            headwind2.textContent = value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
        }
    }
}

function getWindTrend() {
    if (!currentMetarData || !previousMetarData) {
        console.log('⚠️ Wind trend: no data', {current: !!currentMetarData, previous: !!previousMetarData});
        return null;
    }
    if (currentMetarData.wind.calm || previousMetarData.wind.calm) return null;
    if (currentMetarData.wind.vrb || previousMetarData.wind.vrb) return null; // VRB - нет трендов

    const currentSpeed = currentMetarData.wind.speed || 0;
    const previousSpeed = previousMetarData.wind.speed || 0;
    const difference = currentSpeed - previousSpeed;

    console.log('🌬️ Wind trend:', {
        current: currentSpeed,
        previous: previousSpeed,
        diff: difference,
        trend: Math.abs(difference) >= 1 ? (difference > 0 ? 'up' : 'down') : null
    });

    return Math.abs(difference) >= 1 ? (difference > 0 ? 'up' : 'down') : null;
}

function getGustTrend() {
    if (!currentMetarData || !previousMetarData) return null;
    if (currentMetarData.wind.vrb || previousMetarData.wind.vrb) return null; // VRB - нет трендов

    const currentGust = currentMetarData.wind.gust || 0;
    const previousGust = previousMetarData.wind.gust || 0;

    if (currentGust === 0) return null;
    if (previousGust === 0 && currentGust > 0) return 'up';

    const difference = currentGust - previousGust;
    return Math.abs(difference) >= 1 ? (difference > 0 ? 'up' : 'down') : null;
}

function getRunwayHeading(runwayIdent) {
    if (!currentRunwayData) return 0;

    for (const runway of currentRunwayData) {
        if (runway.leIdent === runwayIdent) return runway.leHeading;
        if (runway.heIdent === runwayIdent) return runway.heHeading;
    }

    const runwayNumber = parseInt(runwayIdent.replace(/[LRC]/g, ''));
    return runwayNumber * 10;
}

function getOppositeRunway(selectedRunway) {
    if (!currentRunwayData) return '--';

    for (const runway of currentRunwayData) {
        if (runway.leIdent === selectedRunway) return runway.heIdent;
        if (runway.heIdent === selectedRunway) return runway.leIdent;
    }

    return '--';
}

// ========== OBRABOTCHIKI SOBY`TIJ ==========
function handleIcaoInput() {
    DOM.icaoInput.addEventListener('input', async function() {
        const icao = this.value.toUpperCase();
        this.value = icao;

        if (icao.length === 4) {
            if (!/^[A-Z0-9]{4}$/.test(icao)) {
                updateConnectionStatus('error', 'Invalid ICAO code');
                return;
            }

            updateConnectionStatus('loading', `Loading data for ${icao}...`);
            userPreferredWindUnit = null;

            try {
                await loadMetarWithHistory(icao);
                await updateRunwayOptions(icao);
                updateWeatherDisplay(currentMetarData);

                // Обновляем восход/закат
                const api = await getAPI();
                const airportInfo = api.getAirportInfo(icao);
                if (airportInfo) {
                    updateSunriseSunset(airportInfo.latitude, airportInfo.longitude);
                    console.log('🌅 Sunrise/sunset updated for:', icao, airportInfo.latitude, airportInfo.longitude);
                }

                if (updateInterval) clearInterval(updateInterval);

                updateInterval = setInterval(async () => {
                    try {
                        previousMetarData = currentMetarData;
                        try {
                            const apiHistory = await fetchMetarHistory(icao, 1);
                            currentMetarData = apiHistory && apiHistory.length > 0
                                ? convertApiMetarToAppFormat(apiHistory[apiHistory.length - 1])
                                : await fetchMetarData(icao);
                        } catch (error) {
                            currentMetarData = await fetchMetarData(icao);
                        }
                        saveMetarToLocalHistory(icao, currentMetarData);
                        updateWeatherDisplay(currentMetarData);
                    } catch (error) {
                        console.error('METAR auto-update failed:', error);
                    }
                }, 30000);

                updateConnectionStatus('connected', `${icao} data loaded`);
            } catch (error) {
                console.error(`Failed to load data for ${icao}:`, error);
                updateConnectionStatus('error', `Failed to load ${icao}`);
            }
        } else if (icao.length === 0) {
            if (updateInterval) {
                clearInterval(updateInterval);
                updateInterval = null;
            }

            currentMetarData = null;
            previousMetarData = null;
            currentRunwayData = null;
            userPreferredWindUnit = null;

            DOM.runwaySelect.innerHTML = '<option value="">Enter ICAO code</option>';
            DOM.runwaySelect.disabled = true;
            DOM.runwayDisplay2.textContent = '--';

            drawCompass('compass');
            drawCompass('compass2');
            initializeDefaultCompassInfo(DOM.compassInfo1);
            initializeDefaultCompassInfo(DOM.compassInfo2);

            // Очищаем восход/закат
            if (DOM.sunrise) DOM.sunrise.textContent = '-';
            if (DOM.sunset) DOM.sunset.textContent = '-';

            updateConnectionStatus('', 'Enter ICAO code');
        } else {
            updateConnectionStatus('loading', `Type ${4 - icao.length} more characters...`);
        }
    });
}

async function updateRunwayOptions(icao) {
    DOM.runwaySelect.innerHTML = '<option value="">Loading runways...</option>';
    DOM.runwaySelect.disabled = true;

    try {
        const api = await getAPI();
        currentRunwayData = await api.getRunwayData(icao);

        if (!currentRunwayData || currentRunwayData.length === 0) {
            throw new Error(`No runways for ${icao}`);
        }

        const runwayList = [];
        currentRunwayData.forEach(runway => {
            if (runway.leIdent && runway.leIdent !== '-' && runway.leIdent.trim()) {
                runwayList.push(runway.leIdent.trim());
            }
            if (runway.heIdent && runway.heIdent !== '-' && runway.heIdent.trim()) {
                runwayList.push(runway.heIdent.trim());
            }
        });

        const uniqueRunways = [...new Set(runwayList)].sort();

        if (uniqueRunways.length === 0) {
            throw new Error(`No valid runway identifiers for ${icao}`);
        }

        DOM.runwaySelect.innerHTML = '';
        uniqueRunways.forEach(runway => {
            DOM.runwaySelect.appendChild(new Option(runway, runway));
        });

        let selectedRunway = uniqueRunways[0];
        if (currentMetarData?.runwayStates?.length > 0) {
            const firstRunwayInMetar = currentMetarData.runwayStates[0].runway;
            if (uniqueRunways.includes(firstRunwayInMetar)) {
                selectedRunway = firstRunwayInMetar;
            }
        }

        DOM.runwaySelect.value = selectedRunway;
        DOM.runwaySelect.disabled = false;

        updateOppositeRunway();

        if (currentMetarData) {
            initializeCompass('compass');
            initializeCompass('compass2');
            updateWindComponents();
            updateQFEForSelectedRunways();
            updateCompassInfoData();
        }

        updateConnectionStatus('connected', `${uniqueRunways.length} runways loaded`);
    } catch (error) {
        console.error(`Failed to load runway data for ${icao}:`, error);
        DOM.runwaySelect.innerHTML = '<option value="">No runway data</option>';
        DOM.runwaySelect.disabled = true;
        DOM.runwayDisplay2.textContent = '--';
        currentRunwayData = null;
        drawCompass('compass');
        drawCompass('compass2');
        updateConnectionStatus('error', `No runway data for ${icao}`);
    }
}

function updateOppositeRunway() {
    const selectedRunway = DOM.runwaySelect.value;
    const oppositeRunway = getOppositeRunway(selectedRunway);
    DOM.runwayDisplay2.textContent = oppositeRunway;

    if (currentMetarData) {
        initializeCompass('compass');
        initializeCompass('compass2');
        updateWindComponents();
        updateQFEForSelectedRunways();
        updateCompassInfoData();
    }
}

function updateWeatherDisplay(data) {
    if (!data) return;

    window.metarQFE = data.specialConditions?.qfe || null;

    DOM.metarCode.textContent = data.raw;

    if (data.pressure && data.pressure > 0) {
        const pressure = convertPressure(data.pressure);

        // Тренд QNH из previousMetarData
        let qnhTrend = null;
        if (previousMetarData && previousMetarData.pressure) {
            const diff = data.pressure - previousMetarData.pressure;
            qnhTrend = Math.abs(diff) >= 1 ? (diff > 0 ? 'up' : 'down') : null;
            console.log('📊 QNH trend:', {current: data.pressure, previous: previousMetarData.pressure, diff, trend: qnhTrend});
        }

        DOM.qnhHpa.innerHTML = pressure.hpa + trendManager.getTrendHTML(qnhTrend);
        DOM.qnhMmhg.textContent = pressure.mmhg;
        DOM.qnhInhg.textContent = pressure.inhg;
    }

    if (data.temperature !== null) {
        // Тренд температуры из previousMetarData
        let tempTrend = null;
        if (previousMetarData && previousMetarData.temperature !== null) {
            const diff = data.temperature - previousMetarData.temperature;
            tempTrend = Math.abs(diff) >= 1 ? (diff > 0 ? 'up' : 'down') : null;
            console.log('🌡️ Temperature trend:', {current: data.temperature, previous: previousMetarData.temperature, diff, trend: tempTrend});
        }

        DOM.tempValue.innerHTML = data.temperature + trendManager.getTrendHTML(tempTrend);
    }

    if (data.dewpoint !== null) {
        // Тренд точки росы из previousMetarData
        let dewTrend = null;
        if (previousMetarData && previousMetarData.dewpoint !== null) {
            const diff = data.dewpoint - previousMetarData.dewpoint;
            dewTrend = Math.abs(diff) >= 1 ? (diff > 0 ? 'up' : 'down') : null;
            console.log('💧 Dewpoint trend:', {current: data.dewpoint, previous: previousMetarData.dewpoint, diff, trend: dewTrend});
        }

        DOM.dewValue.innerHTML = data.dewpoint + trendManager.getTrendHTML(dewTrend);
    }

    // Видимость (MOR) с трендом
    if (data.visibility) {
        let morTrend = null;
        if (previousMetarData && previousMetarData.visibility) {
            const diff = data.visibility - previousMetarData.visibility;
            morTrend = Math.abs(diff) >= 1 ? (diff > 0 ? 'up' : 'down') : null;
            console.log('👁️ Visibility trend:', {current: data.visibility, previous: previousMetarData.visibility, diff, trend: morTrend});
        }

        DOM.morValue.innerHTML = data.visibility + trendManager.getTrendHTML(morTrend);
    } else {
        DOM.morValue.textContent = '-';
    }

    // QBB (высота нижней границы облаков) с трендом
    if (data.specialConditions && data.specialConditions.qbb) {
        let qbbTrend = null;
        if (previousMetarData && previousMetarData.specialConditions && previousMetarData.specialConditions.qbb) {
            const diff = data.specialConditions.qbb - previousMetarData.specialConditions.qbb;
            qbbTrend = Math.abs(diff) >= 1 ? (diff > 0 ? 'up' : 'down') : null;
            console.log('☁️ QBB trend:', {current: data.specialConditions.qbb, previous: previousMetarData.specialConditions.qbb, diff, trend: qbbTrend});
        }

        DOM.qbbValue.innerHTML = data.specialConditions.qbb + trendManager.getTrendHTML(qbbTrend);
    } else {
        DOM.qbbValue.textContent = '-';
    }

    if (currentRunwayData) {
        initializeCompass('compass');
        initializeCompass('compass2');
        updateWindComponents();
        updateQFEForSelectedRunways();
        updateCompassInfoData();
    }
}

function toggleWindUnits() {
    const windUnits = document.querySelectorAll('.wind-unit');
    if (!windUnits || windUnits.length === 0) return;

    const currentUnit = windUnits[0].textContent;
    userPreferredWindUnit = currentUnit === 'm/s' ? 'kt' : 'm/s';
    windUnits.forEach(unit => unit.textContent = userPreferredWindUnit);

    if (currentMetarData) {
        addWindToCompass('compass');
        addWindToCompass('compass2');
    }
}

function applyTheme(theme) {
    const hour = new Date().getHours();
    if (theme === 'auto') {
        document.body.classList.toggle('dark', hour < 6 || hour >= 18);
    } else {
        document.body.classList.toggle('dark', theme === 'dark');
    }
}

function applyLanguage(lang) {
    const translations = {
        ru: {
            timeLabel:'Время UTC',
            sunriseLabel:'Восход',
            sunsetLabel:'Заход',
            weatherLabel:'Явления погоды',
            morLabel:'Видимость',
            qbbLabel:'ВНГО',
            skyConditionLabel:'Облачность',
            forecastLabel:'Прогноз погоды',
            specialLabel:'Особые условия',
            lateralLabels:'Боковая',
            headwindLabels:'Встречная',
            frictionLabels:'КСц',
            morUnits:'м'
        },
        en: {
            timeLabel:'Time UTC',
            sunriseLabel:'Sunrise',
            sunsetLabel:'Sunset',
            weatherLabel:'Weather',
            morLabel:'Visibility',
            qbbLabel:'QBB',
            skyConditionLabel:'Sky condition',
            forecastLabel:'Weather forecast',
            specialLabel:'Special conditions',
            lateralLabels:'Side',
            headwindLabels:'Head',
            frictionLabels:'Breaking action',
            morUnits:'m'
        }
    };

    const t = translations[lang];

    DOM.timeLabel.textContent = t.timeLabel;
    DOM.sunriseLabel.textContent = t.sunriseLabel;
    DOM.sunsetLabel.textContent = t.sunsetLabel;
    document.getElementById('weatherLabel').textContent = t.weatherLabel;
    document.getElementById('morLabel').textContent = t.morLabel;
    document.getElementById('qbbLabel').textContent = t.qbbLabel;
    document.getElementById('skyConditionLabel').textContent = t.skyConditionLabel;
    document.getElementById('forecastLabel').textContent = t.forecastLabel;
    document.getElementById('specialLabel').textContent = t.specialLabel;
    document.getElementById('lateralLabel1').textContent = t.lateralLabels;
    document.getElementById('headwindLabel1').textContent = t.headwindLabels;
    document.getElementById('frictionLabel1').textContent = t.frictionLabels;
    document.getElementById('lateralLabel2').textContent = t.lateralLabels;
    document.getElementById('headwindLabel2').textContent = t.headwindLabels;
    document.getElementById('frictionLabel2').textContent = t.frictionLabels;

    if (currentMetarData) {
        updateWeatherDisplay(currentMetarData);
    }

    if (!currentMetarData || !currentRunwayData) {
        initializeDefaultCompassInfo(DOM.compassInfo1);
        initializeDefaultCompassInfo(DOM.compassInfo2);
    }
}

// ========== DOPOLNITEL`NY`E FUNKCZII ==========
const weatherHybridDictionary = {
    'TS': {en: 'thunderstorm', ru: 'гроза'},
    'TSRA': {en: 'thunderstorm with rain', ru: 'гроза с дождём'},
    'SHRA': {en: 'rain showers', ru: 'ливневый дождь'},
    'RA': {en: 'rain', ru: 'дождь'},
    'SN': {en: 'snow', ru: 'снег'},
    'FG': {en: 'fog', ru: 'туман'},
    'BR': {en: 'mist', ru: 'дымка'}
};

function attachTimeClickHandlers() {
    console.log('Time click handlers attached');
}

function updateSunriseSunset(latitude, longitude) {
    if (!latitude || !longitude) {
        if (DOM.sunrise) DOM.sunrise.textContent = '-';
        if (DOM.sunset) DOM.sunset.textContent = '-';
        return;
    }

    const now = new Date();
    const times = calculateSunriseSunset(latitude, longitude, now);

    if (times && times.sunrise && times.sunset) {
        if (DOM.sunrise) DOM.sunrise.textContent = times.sunrise;
        if (DOM.sunset) DOM.sunset.textContent = times.sunset;
    } else {
        if (DOM.sunrise) DOM.sunrise.textContent = '-';
        if (DOM.sunset) DOM.sunset.textContent = '-';
    }
}

function calculateSunriseSunset(lat, lon, date) {
    // Упрощённый расчёт восхода и заката (Julian day method)
    const J2000 = 2451545.0;
    const degToRad = Math.PI / 180;
    const radToDeg = 180 / Math.PI;

    // Текущий Julian Day
    const JD = Math.floor((date.getTime() / 86400000) + 2440587.5);
    const n = JD - J2000;

    // Средняя долгота солнца
    const L = (280.460 + 0.9856474 * n) % 360;

    // Средняя аномалия солнца
    const g = (357.528 + 0.9856003 * n) % 360;
    const gRad = g * degToRad;

    // Эклиптическая долгота
    const lambda = (L + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad)) % 360;
    const lambdaRad = lambda * degToRad;

    // Наклон эклиптики
    const epsilon = 23.439 - 0.0000004 * n;
    const epsilonRad = epsilon * degToRad;

    // Склонение солнца
    const delta = Math.asin(Math.sin(epsilonRad) * Math.sin(lambdaRad)) * radToDeg;
    const deltaRad = delta * degToRad;

    // Часовой угол
    const latRad = lat * degToRad;
    const cosH0 = (Math.sin(-0.833 * degToRad) - Math.sin(latRad) * Math.sin(deltaRad)) /
                  (Math.cos(latRad) * Math.cos(deltaRad));

    // Проверка на полярный день/ночь
    if (cosH0 > 1 || cosH0 < -1) {
        return null;
    }

    const H0 = Math.acos(cosH0) * radToDeg;

    // Время восхода и заката в UTC
    const transit = (JD + (0 - lon) / 360) % 1;
    const sunrise = (transit - H0 / 360 + 1) % 1;
    const sunset = (transit + H0 / 360 + 1) % 1;

    // Конвертация в часы:минуты UTC
    const formatTime = (fraction) => {
        const hours = Math.floor(fraction * 24);
        const minutes = Math.floor((fraction * 24 - hours) * 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    return {
        sunrise: formatTime(sunrise),
        sunset: formatTime(sunset)
    };
}

function updateRVRDisplay(compassInfoElement, runwayIdent) {
    if (!currentMetarData?.rvrData?.length || !runwayIdent || runwayIdent === '--') return;
    const rvrRow = compassInfoElement.querySelector('.rvr-row .data-field');
    if (rvrRow) rvrRow.textContent = '-';
}

function updateQFEDisplay(compassInfoElement, qfeValue, elevation) {
    if (!qfeValue || qfeValue <= 0) return;

    const qfePressure = convertPressure(qfeValue);
    let qfeRow = compassInfoElement.querySelector('.qfe-row');

    if (qfeRow) {
        const fields = qfeRow.querySelectorAll('.data-field');
        if (fields[0]) fields[0].textContent = qfePressure.hpa;
        if (fields[1]) fields[1].textContent = qfePressure.mmhg;
        if (fields[2]) fields[2].textContent = qfePressure.inhg;
    }
}

function updateRunwayStateDisplay(compassInfoElement, runwayIdent) {
    if (!currentMetarData?.runwayStates?.length || !runwayIdent || runwayIdent === '--') return;
}

async function updateQFEForSelectedRunways() {
    if (!currentMetarData || !currentRunwayData) return;

    try {
        const api = await getAPI();

        const selectedRunway1 = DOM.runwaySelect.value;
        if (selectedRunway1) {
            const elevation1 = api.getRunwayElevation(currentRunwayData, selectedRunway1);
            const qfe1 = api.calculateQFE(currentMetarData.pressure, elevation1);
            updateQFEDisplay(DOM.compassInfo1, qfe1, elevation1);
        }

        const selectedRunway2 = DOM.runwayDisplay2.textContent;
        if (selectedRunway2 && selectedRunway2 !== '--') {
            const elevation2 = api.getRunwayElevation(currentRunwayData, selectedRunway2);
            const qfe2 = api.calculateQFE(currentMetarData.pressure, elevation2);
            updateQFEDisplay(DOM.compassInfo2, qfe2, elevation2);
        }
    } catch (error) {
        console.error('QFE update error:', error);
    }
}

// ========== INICZIALIZACZIYA ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('✓ Initializing VATSIM AWOSD v1.1.0...');

    initDOMCache();

    drawCompass('compass');
    drawCompass('compass2');
    initializeDefaultCompassInfo(DOM.compassInfo1);
    initializeDefaultCompassInfo(DOM.compassInfo2);

    setInterval(() => {
        const now = new Date();
        if (DOM.currentTime) {
            const hours = now.getUTCHours().toString().padStart(2, '0');
            const minutes = now.getUTCMinutes().toString().padStart(2, '0');
            DOM.currentTime.textContent = `${hours}:${minutes}`;
        }
    }, 1000);

    DOM.theme.addEventListener('change', function() {
        applyTheme(this.value);
    });

    DOM.language.addEventListener('change', function() {
        applyLanguage(this.value);
    });

    applyTheme('auto');
    applyLanguage('en');

    handleIcaoInput();

    DOM.runwaySelect.addEventListener('change', updateOppositeRunway);

    document.querySelectorAll('.wind-direction, .wind-speed, .wind-unit').forEach(element => {
        element.style.cursor = 'pointer';
        element.addEventListener('click', toggleWindUnits);
    });

    window.addEventListener('resize', () => {
        setTimeout(() => {
            if (currentRunwayData && currentMetarData) {
                initializeCompass('compass');
                initializeCompass('compass2');
            } else {
                drawCompass('compass');
                drawCompass('compass2');
            }
        }, 100);
    });

    console.log('Application initialized successfully - v1.1.0');
});

// ========== UPDATE COMPASS INFO DATA ==========
async function updateCompassInfoData() {
    if (!currentMetarData || !currentRunwayData) return;

    try {
        const api = await getAPI();

        // Obnovlyaem danny`e dlya pervoj VPP
        const selectedRunway1 = DOM.runwaySelect.value;
        if (selectedRunway1) {
            updateCompassInfoForRunway(DOM.compassInfo1, selectedRunway1, api);
        }

        // Obnovlyaem danny`e dlya protivopolozhnoj VPP
        const selectedRunway2 = DOM.runwayDisplay2.textContent;
        if (selectedRunway2 && selectedRunway2 !== '--') {
            updateCompassInfoForRunway(DOM.compassInfo2, selectedRunway2, api);
        }
    } catch (error) {
        console.error('Failed to update compass info:', error);
    }
}

function updateCompassInfoForRunway(compassInfoElement, runwayIdent, api) {
    if (!compassInfoElement || !runwayIdent || !currentMetarData || !currentRunwayData) return;

    // 1. Obnovlyaem RVR с трендом
    const rvrRow = compassInfoElement.querySelector('.rvr-row .data-field');
    if (rvrRow) {
        const rvrData = currentMetarData.rvrData?.find(rvr => rvr.runway === runwayIdent);
        if (rvrData) {
            let rvrText = rvrData.prefix + rvrData.value;
            if (rvrData.isVariable && rvrData.valueMax) {
                rvrText += `/${rvrData.prefixMax}${rvrData.valueMax}`;
            }

            // Тренд RVR
            let rvrTrend = null;
            if (previousMetarData && previousMetarData.rvrData) {
                const prevRvrData = previousMetarData.rvrData.find(rvr => rvr.runway === runwayIdent);
                if (prevRvrData) {
                    const diff = rvrData.value - prevRvrData.value;
                    rvrTrend = Math.abs(diff) >= 1 ? (diff > 0 ? 'up' : 'down') : null;
                    console.log('🛬 RVR trend:', runwayIdent, {current: rvrData.value, previous: prevRvrData.value, diff, trend: rvrTrend});
                }
            }

            rvrRow.innerHTML = rvrText + trendManager.getTrendHTML(rvrTrend);
        } else {
            rvrRow.textContent = '-';
        }
    }

    // 2. Obnovlyaem ELEV (vy`sota poroga VPP)
    const elevRow = compassInfoElement.querySelector('.elev-row .data-field');
    if (elevRow) {
        const elevation = api.getRunwayElevation(currentRunwayData, runwayIdent);
        if (elevation !== null) {
            elevRow.textContent = Math.round(elevation);
        } else {
            elevRow.textContent = '-';
        }
    }

    // 3. Obnovlyaem QFE с трендом
    const qfeRow = compassInfoElement.querySelector('.qfe-row');
    if (qfeRow && currentMetarData.pressure) {
        const elevation = api.getRunwayElevation(currentRunwayData, runwayIdent);
        let qfeValue = api.calculateQFE(currentMetarData.pressure, elevation);

        // Proveryaem, est` li QFE iz METAR
        if (currentMetarData.specialConditions?.qfe) {
            qfeValue = currentMetarData.specialConditions.qfe;
        }

        if (qfeValue && qfeValue > 0) {
            const qfePressure = convertPressure(qfeValue);

            // Тренд QFE
            let qfeTrend = null;
            if (previousMetarData && previousMetarData.pressure) {
                const prevElevation = api.getRunwayElevation(currentRunwayData, runwayIdent);
                let prevQfeValue = api.calculateQFE(previousMetarData.pressure, prevElevation);

                if (previousMetarData.specialConditions?.qfe) {
                    prevQfeValue = previousMetarData.specialConditions.qfe;
                }

                if (prevQfeValue) {
                    const diff = qfeValue - prevQfeValue;
                    qfeTrend = Math.abs(diff) >= 1 ? (diff > 0 ? 'up' : 'down') : null;
                    console.log('✈️ QFE trend:', runwayIdent, {current: qfeValue, previous: prevQfeValue, diff, trend: qfeTrend});
                }
            }

            const fields = qfeRow.querySelectorAll('.data-field');
            if (fields[0]) fields[0].innerHTML = qfePressure.hpa + trendManager.getTrendHTML(qfeTrend);
            if (fields[1]) fields[1].textContent = qfePressure.mmhg;
            if (fields[2]) fields[2].textContent = qfePressure.inhg;
        }
    }

    // 4. Obnovlyaem sostoyanie VPP (RWY)
    const runwayStateRow = compassInfoElement.querySelector('.runway-state-row');
    if (runwayStateRow) {
        const runwayState = currentMetarData.runwayStates?.find(state =>
            state.runway === runwayIdent || state.runway === '88'
        );

        if (runwayState) {
            const depositCodes = {
                '0': 'CLR', '1': 'WET', '2': 'H₂O', '3': 'RIME',
                '4': 'DRY SNW', '5': 'WET SNW', '6': 'SLH',
                '7': 'ICE', '8': 'CMP SNW', '9': 'RUT'
            };

            const extentCodes = {
                '1': '10%', '2': '25%', '5': '50%', '9': '100%'
            };

            const frictionCodes = {
                '91': 'POOR', '92': 'M/POOR', '93': 'MEDIUM',
                '94': 'M/GOOD', '95': 'GOOD', '99': 'N/A'
            };

            // Tip pokry`tiya
            const surfaceItem = runwayStateRow.querySelector('.surface .state-value');
            if (surfaceItem) {
                surfaceItem.textContent = depositCodes[runwayState.deposit] || runwayState.deposit;
            }

            // Stepen` pokry`tiya
            const contaminationItem = runwayStateRow.querySelector('.contamination .state-value');
            if (contaminationItem) {
                contaminationItem.textContent = extentCodes[runwayState.extent] || runwayState.extent;
            }

            // Glubina/Koe`fficzient sczepleniya
            const depthItem = runwayStateRow.querySelector('.depth .state-value');
            if (depthItem) {
                const friction = frictionCodes[runwayState.friction];
                if (friction) {
                    depthItem.textContent = friction;
                } else {
                    const depth = parseInt(runwayState.depth);
                    depthItem.textContent = depth === 92 ? '10cm' :
                                           depth === 93 ? '15cm' :
                                           depth === 94 ? '20cm' :
                                           depth === 95 ? '25cm' :
                                           depth === 96 ? '30cm' :
                                           depth === 97 ? '35cm' :
                                           depth === 98 ? '40cm' :
                                           depth === 99 ? 'N/A' : `${depth}mm`;
                }
            }
        } else {
            // Net danny`x o sostoyanii VPP
            runwayStateRow.querySelectorAll('.state-value').forEach(el => el.textContent = '-');
        }
    }
}
