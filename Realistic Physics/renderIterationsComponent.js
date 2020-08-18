import {tickCounter} from '../../globals';
import {getTickCounter} from '../../globals';
import {setTickCounter} from '../../globals';

export var iterationsObj = {

    schema: {
      count: { type: 'number', default: 0 },
      position: { "x":0, "y":0, "z":0}
    },

    tick: function(){
      setTickCounter(getTickCounter() + 1);
      console.log('Tick de renderizado de A-FRAME');
    },

}
