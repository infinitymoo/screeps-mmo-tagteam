var baseCommon = require('base.common');
var creepCommon = require('creep.common');

global.lastMemoryTick = undefined;

function tryInitSameMemory() {
    if (lastMemoryTick && global.LastMemory && Game.time == (lastMemoryTick + 1)) {
        delete global.Memory
        global.Memory = global.LastMemory
        RawMemory._parsed = global.LastMemory
    } else {
        Memory;
        global.LastMemory = RawMemory._parsed
    }
    lastMemoryTick = Game.time
}

module.exports.loop = function () {

    tryInitSameMemory();
    
    //game loops to run
    baseCommon.run();
    creepCommon.run();

    //save states from cached variables
    baseCommon.save();

    //if we're not in a simulation or private server, generate pixels for persistent online worlds
    try {
        if( Game.cpu && Game.cpu.bucket && Game.cpu.generatePixel() )
            if(Game.cpu.bucket == 10000)
                Game.cpu.generatePixel();
    }
    catch(problem) {
        //do nothing for now as this is expected to fail in sim/private server only.
        //console.log(`E main.loop(generatePixel()): ${problem.name}:${problem.message} ${problem.stack}`);
    }
}

// commands examples
// Memory.rooms['E38N53'].remoteSources.push({id:'5bbcab769099fc012e6338fb',room:'W27N56',x:'',y:''})
// Game.spawns['Spawn1'].spawnCreep([WORK,WORK,WORK,WORK,WORK,CARRY,MOVE],"harvester1",{memory:{role:'harvester',source:'5bbcaf299099fc012e63a41f',homeRoom:'E38N53'}})
// Game.spawns['Spawn1'].spawnCreep([CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE],"transport1",{memory:{role:'transport',target:'5bbcaf299099fc012e63a41a',homeRoom:'E38N53'}})
// Game.spawns['Spawn1'].spawnCreep([TOUGH,TOUGH,TOUGH,],"ac1",{memory:{role:'attacker',target:'606893f710cdfaf1e7eae488','targetRoom':'W25N57'}})
// Game.spawns['Spawn1'].spawnCreep([CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,],"refiller1",{memory:{role:'refiller'}})

/**
 * manual spawning
 * 
 * Memory.rooms['E38N53'].spawnQueue.p.baseFunction.push({memory:{class:'courier',role:'refiller'}})
 * Memory.rooms['E38N53'].spawnQueue.p.maintenance.push({memory:{class:'worker',role:'builder',targetRoom:'E37N54',mode:'normal'},sizingParms:{policy:"max"}})
 * Memory.rooms['E38N53'].spawnQueue.p.maintenance.push({memory:{class:'worker',role:'repairer',mode:'roadworker',targetRoom:'E38N52'},sizingParms:{policy:"min"}})
 * Memory.rooms['E38N53'].spawnQueue.p.defense.push({memory:{class:'defense',role:'attacker',targetRoom:'E37N54',mode:'dorespawn'}})
 * 
 * 
 * Memory.rooms['E38N53'].spawnQueue.g.acquisition.push({memory:{class:'miner',role:'harvester',source:'5bbcaf3c9099fc012e63a5ab'}})
 * Memory.rooms['E38N53'].spawnQueue.g.reserve.push({memory:{class:'reserver',role:'claimer',targetRoom:'E36N53'}})
 * Memory.rooms['E38N53'].spawnQueue.g.logistics.push({memory:{class:'courier',role:'transport'}})
 * Memory.rooms['E38N53'].spawnQueue.g.logistics.push({memory:{class:'courier',role:'supplier',pickupTarget:'5ea22007922f3dc7a4b1d467',mode:'remote'}})
 * 
 * Memory.rooms['E38N53'].spawnQueue.e.baseExpansion.push({memory:{class:'specialist',role:'upgrader'}})
 * Memory.rooms['E38N53'].spawnQueue.e.baseExpansion.push({memory:{class:'worker',role:'builder'},sizingParms:{policy:"conserve"}})
 * Memory.rooms['E38N53'].spawnQueue.e.offense.push({memory:{class:'offense',role:'attacker',mode:'mission',targetRoom:'E37N54'}})
 * Memory.rooms['E38N53'].spawnQueue.e.offense.push({memory:{class:'siege',role:'breaker',targetRoom:'E39N51',mode:'dorespawn'}})
 * 
 * 
 * Memory.rooms['E43N51'].spawnQueue.p.maintenance.push({memory:{class:'worker',role:'builder',targetRoom:'E43N51',mode:'normal'},sizingParms:{policy:'conserve'}})
 * Memory.rooms['E43N51'].spawnQueue.p.maintenance.push({memory:{class:'courier',role:'transport',targetRoom:'E43N51',homeRoom:'E43N51'},sizingParms:{policy:"conserve"}})
 * Memory.rooms['E43N51'].spawnQueue.p.maintenance.push({memory:{class:'worker',role:'upgrader',targetRoom:'E43N51'},sizingParms:{policy:"min"}})
 * Memory.rooms['E43N51'].spawnQueue.g.acquisition.push({memory:{class:'miner',role:'harvester',source:'5bbcaf3c9099fc012e63a5ab'}})
 */


/**
 * to do notes - bugs
 * harvesters seem to all be set to use links when just the 3rd link is added to a room, then it freezes and doesn't harvest when full
 * 
 * to do notes - optimization
 * - upgrade save source and only switch/look for new when source pickup/withdraw failed unless its a link, check link contents before withdrawing
 * - harvesters use 2.2+ instead of 1.6 floor - why?
 * - refillers using 1.8 instead of 0.8 floor
 * 
*/