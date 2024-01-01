// Entry point
const maps = require("./maps") // my version of the Google Maps API
let term = require('terminal-kit').terminal;

const addresses = [] // a 2D Array of addresses. Each array inside represents a waypoint.

/**
 * Displays a button to return to the main menu.
 */
function returnButton() {
    term.singleLineMenu(["Return to main menu"], function() {
        term.clear();
        mainMenu();
    })
}

/**
 * Shows the current list of selected places.
 */
function displaySelections() {
    if (addresses.length == 0) {
        term("There are no current selections.\n")
    }
    else {
        for (let i = 0; i < addresses.length; i++) {
            term(i + ". " + addresses[i].join('; ') + "\n");
        }
    }
    returnButton();
}

/**
 * Adds a place to the list of places to visit.
 * The user first chooses a waypoint index to store their selected place in.
 * Then, the search function is called to choose and add the place.
 */
async function addSelection() {
    if (addresses.length != 0) { // nonempty; the user chooses waypoint index
        let list_named = []
        for (let i = 0; i < addresses.length; i++) {
            list_named.push(i + ". " + addresses[i]);
        }
        // add the additional beginning and end options
        list_named.unshift("-1. Beginning")
        list_named.push(addresses.length + ". End")
        list_named.push("Return to main menu")
        term("Where would you like to add your new selection?")
        term.singleColumnMenu(list_named, function(_err, response) { 
            let text = response.selectedText;
            if (text.startsWith("Return")) {
                term.clear();
                mainMenu();
            }
            else { // should be a number up until the first period, consider double-digit numbers
                let index = Number.parseInt(text.substring(0, text.indexOf(".")));
                search(index);
            }
        }); // avoid using await and promise, didn't work ??
    }
    else { // by default, add to the 0th index
        search(0);
    }
}

/**
 * Prompts the user to search for the place to add.
 * Calls the lookup function or the nearbyLookup function.
 * @param {Number} index the waypoint index to add to
 */
function search(index) {
    term.clear();
    let searchItems = [
        "0. Perform a lookup on a single location",
        "1. Perform a search on many locations near a reference location",
        "Go Back"
    ]
    term("How would you like to search for a selection to add?");
    term.singleColumnMenu(searchItems, function(_err, response) {
        term.clear();
        switch (response.selectedIndex) {
            case 0: // Perform a lookup on a single location
                lookup(index); // keep passing index through
                break;
            case 1:
                nearbyLookup(index); // keep passing index through
                break;
            default: // Go Back selection
                // you select an index if there is at least one waypoint already present
                if (addresses.length != 0) {
                    addSelection();
                }
                else { // otherwise, the previous page would be the main menu
                    mainMenu();
                }
                break;
        }
    })
}

/**
 * Looks up a location without using a reference location.
 * Calls addAddress to add an address.
 * @param {Number} index the waypoint index to add to
 */
async function lookup(index) {
    term("Enter a place to search for: ");
    let input = await term.inputField().promise;
    let foundAddress = await maps.searchPlace(input);
    term("\nFound " + foundAddress + "\n");
    term("Is this correct?")
    let searchItems = [
        "Confirm",
        "Try Again",
        "Return to search menu"
    ]
    if (addresses.length > 0) { // only if there is one waypoint present would this be an option
        searchItems.push("Return to index selection");
    }
    term.singleLineMenu(searchItems, function(_err, resp) {
        term.clear();
        switch (resp.selectedText) {
            case "Confirm":
                addAddress(index, foundAddress);
                returnButton();
                break;
            case "Try Again":
                (async()=>{lookup(index)})();
                break;
            case "Return to search menu":
                (async()=>{search(index)})();
                break;
            case "Return to index selection":
                (async()=>{addSelection()})();
                break;
        }
    });
}

/**
 * Looks up location(s) using a reference location.
 * Calls addAddress to add an address.
 * @param {Number} index the waypoint index to add to
 */
async function nearbyLookup(index) {
    term("Enter a reference location to search in e.g. a city name or ZIP code: ")
    let reference = await term.inputField().promise;
    let coords = null;
    try {
        coords = await maps.geocode(reference);
    }
    catch (error) {
        term("\nInvalid location, please try again.\n\n");
        (async()=>{nearbyLookup(index)})();
        return;
    }

    term("\nEnter a place to search for: ");
    let input = await term.inputField().promise;
    let foundAddresses = await maps.nearbySearch(input, coords);

    term("\nChoose from the following matches: \n");

    let searchItems = [
        "Try Again",
        "Return to search menu",
    ]
    if (addresses.length > 0) { // only if there is one waypoint present would this be an option
        searchItems.push("Return to index selection");
    }

    // after finding the places, we add additional menu options to the places as buttons to select
    let items = foundAddresses.concat(searchItems)

    // grid menu instead of the other options for terminal visibility purposes
    term.gridMenu(items, function(_err, resp) {
        term.clear();
        switch (resp.selectedText) {
            case "Try Again":
                (async()=>{nearbyLookup(index)})();
                break;
            case "Return to search menu":
                (async()=>{search(index)})();
                break;
            case "Return to index selection":
                (async()=>{addSelection()})();
                break;
            default:
                addAddress(index, resp.selectedText);
                returnButton();
                break;
        }
    });
}

/**
 * Adds an address to the address list.
 * @param {Number} index 
 * @param {string} address 
 */
function addAddress(index, address) {
    if (index == -1) { // add to the beginning; put the address in a new array
        addresses.unshift([address]);
        term("Address added successfully.\n");
    }
    else if (index == addresses.length) { // add to the end; also new array
        addresses.push([address]);
        term("Address added successfully.\n");
    }
    else { // an index already inside the array; check for duplicates before adding
        // no out of bounds checking necessary
        if (!addresses[index].includes(address)) {
            addresses[index].push(address);
            term("Address added successfully.\n");
        }
        else {
            term("Address is a duplicate. Not added.\n");
        }
    }
}

/**
 * Removes an address from one of the waypoints.
 * Removes the waypoint from the address array entirely if it is empty.
 */
function removeSelection() {
    if (addresses.length != 0) { // only applicable to nonempty array
        let list_named = []
        for (let i = 0; i < addresses.length; i++) {
            list_named.push(i + ". " + addresses[i]);
        }
        list_named.push("Return to main menu")
        term("Choose which to remove from.")
        term.singleColumnMenu(list_named, function(_err, response) { 
            let index = response.selectedIndex;
            if (index == list_named.length - 1) { // Return is the last index
                term.clear();
                mainMenu();
            }
            else {
                // now we check if the list only has one
                if (addresses[index].length == 1) { // if it's just one, remove the array entirely
                    addresses.splice(index, 1);
                    term("Address removed successfully.\n");
                    returnButton();
                }
                else { // else we choose a single one to remove from the array
                    term("\nChoose one to remove.")
                    let removal_selection = [];
                    for (let i = 0; i < addresses[index].length; i++) {
                        removal_selection.push(i + ". " + addresses[index][i]);
                    }
                    removal_selection.push("Return to removal selection menu");

                    term.singleColumnMenu(removal_selection, function(_err, resp) { 
                        term.clear();
                        let removeIndex = resp.selectedIndex;
                        if (removeIndex == removal_selection.length - 1) { // Return is the last index
                            removeSelection();
                        }
                        else {
                            addresses[index].splice(removeIndex, 1); // remove the address
                            if (addresses[index].length == 0) { // if the address was the only one, remove that array entirely
                                addresses.splice(index, 1); // no empty lists
                            }
                            term("Address removed successfully.\n");
                            returnButton();
                        }
                    });
                }
            }
        });
    }
    else {
        term("There are no current selections.\n")
        term.singleLineMenu(["Return to main menu"], function() {
            term.clear();
            mainMenu();
        })
    }
}

/**
 * Calculates the shortest route from all of the addresses provided.
 * There must be at least two waypoints.
 */
async function calculate() {
    if (addresses.length == 0) {
        term("There are no selected places to generate routes for.\n");
    }
    else if (addresses.length == 1) {
        term("There are not enough places to generate routes for.\n");
    }
    else {
        term("Calculating the shortest routes...\n\n");
        let output = await maps.findRoutes(addresses);
        term(output);
    }
    returnButton();
}

// Main Menu
let items = [
    '0. Display current location selections',
    '1. Add a selection',
    '2. Remove a selection',
    '3. Calculate the shortest route',
    '4. Exit'
]

/**
 * Displays the main menu.
 */
function mainMenu() {
    term("Welcome to PathFinder.");
    term.singleColumnMenu(items, function(_err, response) {
        term.clear();
        switch (response.selectedIndex) {
            case 0:
                displaySelections();
                break;
            case 1:
                addSelection();
                break;
            case 2:
                removeSelection();
                break;
            case 3:
                calculate();
                break;
            case 4:
                process.exit();
            default: // placeholder
                mainMenu();
        }
    })
}

mainMenu();
