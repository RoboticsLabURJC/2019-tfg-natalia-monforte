export var arrayIds = [];
export var arrayRobots = [];
export var arrayInitialPos = [];

export var tickCounter = 0;

export function getTickCounter() {
    return tickCounter;
}
export function setTickCounter(value) {
    tickCounter = value;
}

export var arrayLoadedBodyRobots = [];
export var simEnabled = true;

export function setSimulationValue(value) {
    simEnabled = value;
}
