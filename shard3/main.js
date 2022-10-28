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
// Memory.rooms['E38N53'].spawnQueue.push({memory: { role:'harvester',source:'5bbcaf299099fc012e63a41f'} })
// Memory.rooms['E38N53'].spawnQueue.push({memory: { role:'transport',target:'5bbcab769099fc012e6338f6'} })
// Memory.rooms['E38N53'].spawnQueue.push({memory: { role:'builder',mode:'roadworker',targetRoom:'E38N53'} })
// Memory.rooms['E38N53'].spawnQueue.push({memory: { role:'attacker',targetRoom:'W27N56'} })
// Memory.rooms['E38N53'].spawnQueue.push({memory: { role:'transport'} })
// Memory.rooms['E38N53'].spawnQueue.push({memory: { role:'claimer',targetRoom:''} })
// Game.spawns['Spawn1'].spawnCreep([WORK,WORK,WORK,WORK,WORK,CARRY,MOVE],"harvester1",{memory:{role:'harvester',source:'5bbcaf299099fc012e63a41f',homeRoom:'E38N53'}})
// Game.spawns['Spawn1'].spawnCreep([CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE],"transport1",{memory:{role:'transport',target:'5bbcaf299099fc012e63a41a',homeRoom:'E38N53'}})
// Game.spawns['Spawn1'].spawnCreep([TOUGH,TOUGH,TOUGH,],"ac1",{memory:{role:'attacker',target:'606893f710cdfaf1e7eae488','targetRoom':'W25N57'}})
// Game.spawns['Spawn1'].spawnCreep([CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,],"refiller1",{memory:{role:'refiller'}})