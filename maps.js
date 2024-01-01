const fetch = require('node-fetch');
const headers = {
    "User-Agent": "node-fetch"
}; // necessary to avoid 'invalid json response body' error

require('dotenv').config()
const apiKey = process.env.GOOGLE_MAPS_API_KEY

/**
 * Searches for a single place using the Google Maps API.
 * @param {string} query 
 * @returns the place name and address
 */
async function searchPlace(query) {
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?fields=formatted_address,name&input=${
        encodeURIComponent(query)
    }&inputtype=textquery&key=${apiKey}`;

    const response = await fetch(url, {headers});
    const data = await response.json();

    let candidate = data.candidates[0];

    return `'${candidate.name}' at ${candidate.formatted_address}`.trim(); // sometimes an extra newline
}

/**
 * Returns the latitude and longitude coordinates of a location.
 * This will be called if the user does not provide a specific address to start at.
 * The return value of this function should be used in the function nearbySearch.
 * @param {string} location the reference location to geocode
 * @returns coordinates
 */
async function geocode(location) { // assumes United States in &region=
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${
        encodeURIComponent(location)
    }&region=us&key=${apiKey}`
    const response = await fetch(url, {headers});
    const data = await response.json();

    let coords = data.results[0].geometry.location
    let lat = coords.lat
    let lng = coords.lng
    return lat + "," + lng;
}

/**
 * Searches for a place given a reference location to search within a 50000 meter radius of.
 * @param {string} keyword the place to search for
 * @param {string} coordinates the coordinates in the format latitude,longitude; this should be obtained from the geocode function.
 * @returns a list of the places that match the query
 */
async function nearbySearch(keyword, coordinates) {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?keyword=${
        encodeURIComponent(keyword)
    }&location=${
        encodeURIComponent(coordinates)
    }&radius=50000&key=${apiKey}`
    const response = await fetch(url, {headers});
    const data = await response.json();

    let output = [] // reformat the data
    data.results.forEach(element => {
        let name = element.name; // name of the place
        let address = element.vicinity; // address of the place
        output.push(`'${name}' at ${address}\n`.trim()); // sometimes an extra newlines
    });
    return output;
}

/**
 * Gets the address from this program's custom formatting of place names and addresses.
 * Since the formatting is 'Place' at Address, we will grab just the Address part.
 */
function extractAddress(place) {
    return place.substring(place.indexOf("' at ") + "' at ".length)
}

/**
 * Recursively generates all possible routes from a list of lists that have addresses.
 */
function generateRoutes(addresses, currentRoute, index, routes) {
    if (index === addresses.length) { // reached the end
        routes.push(currentRoute.slice()); // now add the route that we've created
        return;
    }

    const currentAddresses = addresses[index];
    for (let i = 0; i < currentAddresses.length; i++) {
        currentRoute.push(currentAddresses[i]);
        generateRoutes(addresses, currentRoute, index + 1, routes);
        currentRoute.pop(); // backtrack
    }

    return routes;
}

/**
 * Calculates the shortest distance and the time between two locations.
 * @param {string} origin 
 * @param {string} destination 
 * @returns {Promise<Array<string>>} the distance and time as [dist, time]
 */
async function calculateRoute(origin, destination) {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?destinations=${
        encodeURIComponent(destination)
    }&origins=${
        encodeURIComponent(origin)
    }&key=${apiKey}`
    const response = await fetch(url, {headers});
    const data = await response.json();

    let elements = data.rows[0].elements[0]

    // we want the values as numbers, not just text, for comparison later
    let dist = elements.distance.value * 0.000621371192; // meters to miles conversion
    dist = + dist.toFixed(2); // round to 2 decimals, and make it a number instead of a string with +

    let time = elements.duration.value;
    time = Math.round(time / 60); // time is given in seconds, so divide by 60 to get minutes

    return [dist, time];
}

/**
 * Finds the shortest route in terms of distance, and time.
 * @param {Array.<Array.<string>>} addresses the addresses to calculate routes for
 * @returns the shortest routes
 */
async function findRoutes(addresses) {
    if (addresses.length < 2) {
        return Error("Insufficient amount of addresses.");
    }

    let routes = generateRoutes(addresses, [], 0, []);

    // out of these routes, let's find the route with the shortest distance, and the shortest time
    let shortestDistance = Number.MAX_VALUE;
    let shortestDistanceRoute = null;

    let shortestTime = Number.MAX_VALUE;
    let shortestTimeRoute = null;

    // use maps to store calculations and avoid unnecessary API calls
    let storedDistances = new Map();
    let storedTimes = new Map();

    // calculate each route's distance and time to compare
    for (let i = 0; i < routes.length; i++) { // use a traditional for loop (no forEach) for the async down below
        let route = routes[i];
        let distance = 0.0;
        let time = 0.0;
        for (let j = 0; j < route.length - 1; j++) {
            // calculate the total distance/time, step by step
            // API call wants just the address
            let origin = extractAddress(route[j]);
            let destination = extractAddress(route[j + 1]);

            let key = origin + " " + destination;
            if (storedDistances.has(key)) { // check if we've calculated this previously
                distance += storedDistances.get(key);
                time += storedTimes.get(key) // we can assume that if the distance is stored then time is too
            }
            else {
                let apiCall = await calculateRoute(origin, destination);
                distance += apiCall[0]
                time += apiCall[1]
                storedDistances.set(key, apiCall[0]) // store for future usage
                storedTimes.set(key, apiCall[1])
            }
        }
        if (distance < shortestDistance) {
            shortestDistance = distance;
            shortestDistanceRoute = route;
        }
        if (time < shortestTime) {
            shortestTime = time;
            shortestTimeRoute = route;
        }
    }

    let output = "";
    output += `Shortest Distance Route: ${shortestDistance} miles\n`;
    for (let i = 0; i < shortestDistanceRoute.length; i++) {
        output += `${i + 1}. ${shortestDistanceRoute[i]}\n`;
    }
    output += `\nShortest Time Route: ${shortestTime} minutes\n`;
    for (let i = 0; i < shortestTimeRoute.length; i++) {
        output += `${i + 1}. ${shortestTimeRoute[i]}\n`;
    }

    return output;
}

module.exports = {
    searchPlace,
    geocode,
    nearbySearch,
    findRoutes
}
