var baseCommon = require('base.common');
var creepCommon = require('creep.common');

module.exports.loop = function () {
    
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
 * Memory.rooms['E38N53'].spawnQueue.p.baseFunction.push({memory:{class:'courier',role:'refiller'},sizingParms:{policy:"urgent"}})
 * Memory.rooms['E38N53'].spawnQueue.p.maintenance.push({memory:{class:'worker',role:'builder',mode:'roadworker',targetRoom:''},sizingParms:{policy:"min"}})
 * Memory.rooms['E38N53'].spawnQueue.p.maintenance.push({memory:{class:'worker',role:'repairer',mode:'roadworker',targetRoom:'E38N52'},sizingParms:{policy:"min"}})
 * Memory.rooms['E38N53'].spawnQueue.p.defense.push({memory:{class:'defense',role:'attacker'}})
 * 
 * 
 * Memory.rooms['E38N53'].spawnQueue.g.acquisition.push({memory:{class:'miner',role:'harvester',source:'5bbcaf3c9099fc012e63a5ab'},sizingParms:{policy:"custom",design:"reserved"}})
 * Memory.rooms['E38N53'].spawnQueue.g.reserve.push({memory:{class:'reserver',role:'claimer',targetRoom:''}})
 * Memory.rooms['E38N53'].spawnQueue.g.logistics.push({memory:{class:'courier',role:'transport'},sizingParms:{policy:"max"}})
 * 
 * Memory.rooms['E38N53'].spawnQueue.e.baseExpansion.push({memory:{class:'specialist',role:'upgrader'}})
 * Memory.rooms['E38N53'].spawnQueue.e.baseExpansion.push({memory:{class:'worker',role:'builder'},sizingParms:{policy:"conserve"}})
 * 
 */


