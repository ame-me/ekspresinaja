const https = require('https');
const fs = require('fs');
const path = require('path');

const PROVINCE_URL = 'https://raw.githubusercontent.com/alifbint/indonesia-38-provinsi/main/provinsi.csv';
const CITY_URL = 'https://raw.githubusercontent.com/alifbint/indonesia-38-provinsi/main/kabupaten_kota.csv';
const DISTRICT_URL = 'https://raw.githubusercontent.com/alifbint/indonesia-38-provinsi/main/kecamatan.csv';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch ${url}, status: ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/);
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || i === 0) continue; // skip empty lines and headers
    
    // Pattern to match ID in quotes and name afterwards
    const match = line.match(/^"([^"]+)",\s*(.*)$/);
    if (match) {
      const id = match[1].trim();
      let name = match[2].trim();
      if (name.startsWith('"') && name.endsWith('"')) {
        name = name.slice(1, -1).trim();
      }
      result.push({ id, name });
    }
  }
  return result;
}

async function main() {
  try {
    console.log('Fetching province data...');
    const provinceCSV = await fetchUrl(PROVINCE_URL);
    const provinces = parseCSV(provinceCSV);
    console.log(`Fetched ${provinces.length} provinces.`);

    console.log('Fetching city data...');
    const cityCSV = await fetchUrl(CITY_URL);
    const cities = parseCSV(cityCSV);
    console.log(`Fetched ${cities.length} cities.`);

    console.log('Fetching subdistrict data...');
    const districtCSV = await fetchUrl(DISTRICT_URL);
    const districts = parseCSV(districtCSV);
    console.log(`Fetched ${districts.length} subdistricts.`);

    // Map provinces by ID
    const provinceMap = new Map();
    provinces.forEach(p => provinceMap.set(p.id, p.name));

    // Map cities by ID and save their province name
    const cityMap = new Map();
    cities.forEach(c => {
      const provId = c.id.substring(0, 2);
      const province_name = provinceMap.get(provId);
      cityMap.set(c.id, { name: c.name, province_name });
    });

    const regions = {};

    // 1. Initialize regions with sorted province names
    const sortedProvinces = Array.from(provinceMap.values()).sort();
    sortedProvinces.forEach(provName => {
      regions[provName] = {};
    });

    // 2. Add sorted cities into provinces
    const provinceCities = {};
    for (const [cityId, cityInfo] of cityMap.entries()) {
      const { name: cityName, province_name } = cityInfo;
      if (!province_name) continue;
      if (!provinceCities[province_name]) provinceCities[province_name] = [];
      provinceCities[province_name].push(cityName);
    }

    for (const provName in provinceCities) {
      provinceCities[provName].sort();
      provinceCities[provName].forEach(cityName => {
        regions[provName][cityName] = [];
      });
    }

    // 3. Add sorted subdistricts into cities
    const citySubdistricts = {};
    districts.forEach(d => {
      const cityId = d.id.substring(0, 5);
      if (!citySubdistricts[cityId]) citySubdistricts[cityId] = [];
      citySubdistricts[cityId].push(d.name);
    });

    for (const [cityId, distList] of Object.entries(citySubdistricts)) {
      const cityInfo = cityMap.get(cityId);
      if (!cityInfo) continue;
      const { name: cityName, province_name } = cityInfo;
      if (!province_name || !regions[province_name] || !regions[province_name][cityName]) continue;
      
      distList.sort();
      regions[province_name][cityName] = distList;
    }

    const outputPath = path.join(__dirname, 'indonesia_regions.json');
    console.log(`Writing compiled data to: ${outputPath}`);
    fs.writeFileSync(outputPath, JSON.stringify(regions, null, 2), 'utf8');
    console.log('Success! Regions file generated successfully.');
  } catch (error) {
    console.error('Error running regions generation:', error);
    process.exit(1);
  }
}

main();
