/**
 * Approximate centroid coordinates for Telangana districts.
 *
 * These are used ONLY to place outbreak markers on the map at a
 * DISTRICT level of granularity — never at exact patient/report
 * coordinates. This is an intentional privacy boundary: the map
 * must never be precise enough to identify an individual case.
 *
 * Place this file at: backend2/utils/districtCoordinates.js
 */
const DISTRICT_COORDINATES = {
    "adilabad": { lat: 19.6641, lng: 78.5320 },
    "bhadradri kothagudem": { lat: 17.5566, lng: 80.6197 },
    "hyderabad": { lat: 17.3850, lng: 78.4867 },
    "jagtial": { lat: 18.7909, lng: 78.9101 },
    "jangaon": { lat: 17.7260, lng: 79.1808 },
    "jayashankar bhupalpally": { lat: 18.4386, lng: 79.9629 },
    "jogulamba gadwal": { lat: 16.2311, lng: 77.8060 },
    "kamareddy": { lat: 18.3200, lng: 78.3400 },
    "karimnagar": { lat: 18.4386, lng: 79.1288 },
    "khammam": { lat: 17.2473, lng: 80.1514 },
    "kumuram bheem asifabad": { lat: 19.3600, lng: 79.2800 },
    "mahabubabad": { lat: 17.5991, lng: 80.0022 },
    "mahabubnagar": { lat: 16.7375, lng: 77.9931 },
    "mancherial": { lat: 18.8710, lng: 79.4640 },
    "medak": { lat: 18.0460, lng: 78.2630 },
    "medchal malkajgiri": { lat: 17.6300, lng: 78.4800 },
    "mulugu": { lat: 18.1900, lng: 80.0000 },
    "nagarkurnool": { lat: 16.4800, lng: 78.3200 },
    "nalgonda": { lat: 17.0500, lng: 79.2700 },
    "narayanpet": { lat: 16.7460, lng: 77.4970 },
    "nirmal": { lat: 19.0970, lng: 78.3440 },
    "nizamabad": { lat: 18.6725, lng: 78.0941 },
    "peddapalli": { lat: 18.6150, lng: 79.3730 },
    "rajanna sircilla": { lat: 18.3850, lng: 78.8130 },
    "rangareddy": { lat: 17.2000, lng: 78.3000 },
    "sangareddy": { lat: 17.6250, lng: 78.0800 },
    "siddipet": { lat: 18.1020, lng: 78.8520 },
    "suryapet": { lat: 17.1400, lng: 79.6200 },
    "vikarabad": { lat: 17.3370, lng: 77.9040 },
    "wanaparthy": { lat: 16.3600, lng: 78.0600 },
    "warangal": { lat: 17.9689, lng: 79.5941 },
    "warangal urban": { lat: 17.9689, lng: 79.5941 },
    "hanumakonda": { lat: 18.0000, lng: 79.5800 },
    "warangal rural": { lat: 18.0000, lng: 79.5800 },
    "yadadri bhuvanagiri": { lat: 17.5500, lng: 78.8900 },
};

function getDistrictCoordinates(locationName) {
    if (!locationName || typeof locationName !== "string") return null;
    const key = locationName.trim().toLowerCase();
    if (DISTRICT_COORDINATES[key]) return DISTRICT_COORDINATES[key];

    // Loose match for values like "Khammam District" or partial names
    const found = Object.keys(DISTRICT_COORDINATES).find(
        (name) => key.includes(name) || name.includes(key)
    );
    return found ? DISTRICT_COORDINATES[found] : null;
}

module.exports = { DISTRICT_COORDINATES, getDistrictCoordinates };