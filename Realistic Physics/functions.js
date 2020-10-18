import {spectObject, intersectionHandlerObj, followBodyObj, iterationsObj} from './aframe-components';
import {arrayRobots, arrayIds, arrayLoadedBodyRobots, simEnabled, setSimulationValue, arrayInitialPos} from '../globals';
import {sleep} from '../utils';
import { platform } from 'os';
export var active = false;
export var refreshInterval = null;

export function robotLoader(){
    /**
   * Declares event listener to create robots when DOM even triggered
   */
    document.addEventListener('body-loaded', async (bodyLoaded)=>{
      var exists = arrayIds.includes(bodyLoaded.target.id);
      if(exists){
        var robotID = bodyLoaded.target.id;
        console.log("Body for robot with ID -->", robotID, "loaded.");
        arrayLoadedBodyRobots.push(robotID);
      }
    });
}

export function extendAFrame(){
  /**
   * Configure needed AFRAME components for WebSim
   */
  AFRAME.registerComponent('spectator', spectObject);
  AFRAME.registerComponent("intersection-handler", intersectionHandlerObj);
  AFRAME.registerComponent("follow-body", followBodyObj);
  AFRAME.registerComponent("iterations", iterationsObj);
}

export async function resetSimulation(){
  if(!simEnabled){
    playSimulation();
  }
  await resetElements();
  pauseSimulation();
}

async function resetElements(){
  arrayInitialPos.forEach((element)=>{
    pauseSimulation();
    var el = document.getElementById(element.id);
    el.setAttribute('rotation',element.rotation);
    el.setAttribute('position',element.position);
    playSimulation();
  });
  await sleep(0.05);
}

export function getHalAPI(robotId){
  var robot = null;
  arrayRobots.forEach((robotInstance)=>{
      if (robotId === robotInstance.getID()){
          robot = robotInstance;
      }
  });
  return robot
}

export function pauseSimulation(){
  var scene = document.querySelector("#scene");
  if(simEnabled){
    scene.pause();
    setSimulationValue(false);
  }
}

export function playSimulation(){
  var scene = document.querySelector("#scene");
  if(!simEnabled){
    scene.play();
    setSimulationValue(true);
  }
}
