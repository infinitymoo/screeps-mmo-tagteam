var taskCommon = require('task.common');
var baseCommon = require('base.common');

var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleTransport = require('role.transport');
var roleRepairer = require('role.repairer');
var roleAttacker = require('role.attacker');
var roleRefiller = require('role.refiller');
var roleClaimer = require('role.claimer');
var roleBreaker = require('role.breaker');
var Traveler = require('Traveler');
var spawner = require('spawner');

module.exports.loop = function () {
  
    baseCommon.garbageCollection();

    /** INITIALIZE STATE */
    if(!Memory.rooms) {
        Memory.rooms = {};
    }
    let ownedRooms = baseCommon.getOwnedRooms();
    for(const i in ownedRooms) {
        if( !Memory.rooms[ownedRooms[i]] ) {
            Memory.rooms[ownedRooms[i]] = {};
        }
        if( !Memory.rooms[ownedRooms[i]].spawnQueue ) {
            Memory.rooms[ownedRooms[i]].spawnQueue = [];
        }
    }

    //in this state it means we have to kickstart/boot the room
    // TODO should be per controlled room, not global
    // TODO 
    var creepAmount = 0;
    for(var i in Memory.creeps){creepAmount++};
    
    if( creepAmount < 5 && Memory.rooms[Memory.homeRoom].spawnQueue.length < 7 ) {            
        var sources = Game.rooms[Memory.homeRoom].find(FIND_SOURCES);
        //var sortedSources;
        var startSpawn;
        for(var s in Game.spawns ) {
            startSpawn = s;
        }
        var closestSource = Game.spawns[startSpawn].pos.findClosestByPath(FIND_SOURCES);
        
        spawner.queueSpawn({memory:{role:'harvester',source:closestSource.id}});
        spawner.queueSpawn({memory:{role:'transport'}});
        spawner.queueSpawn({memory:{role:'harvester',source:sources[1].id}});
        spawner.queueSpawn({memory:{role:'transport'}});
        spawner.queueSpawn({memory:{role:'transport'}});
        spawner.queueSpawn({memory:{role:'harvester',source:sources[0].id}});                                                                                                                     
        spawner.queueSpawn({memory:{role:'harvester',source:sources[1].id}});
        spawner.queueSpawn({memory:{role:'upgrader'}});
    }

    try {
        /** TOWER CONTROL */
        var towers = Game.rooms[Memory.homeRoom].find(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_TOWER);
                        }
                    });
                    
        if(towers.length > 0) {
    
            var closestHostile = towers[0].pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if(closestHostile) {
                _.forEach(towers, (tower) => {
                    tower.attack(closestHostile)
                })
            }
            /*
            else {
                var closestDamagedStructure = towers[0].pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (structure) =>
                        (structure.hits < structure.hitsMax) && 
                        (structure.structureType != STRUCTURE_WALL) &&
                        structure.hits < 1000000
                    });
                if(closestDamagedStructure) {
                    _.forEach(towers, (tower) => {
                        tower.repair(closestDamagedStructure);
                    })
                }
                else {
                    closestDamagedStructure = towers[0].pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) =>
                            (structure.hits < structure.hitsMax) && 
                            (structure.structureType != STRUCTURE_WALL) &&
                            structure.hits < 2000000
                        });
                    if(closestDamagedStructure) {
                        _.forEach(towers, (tower) => {
                            tower.repair(closestDamagedStructure);
                        })
                }
                }
            }
            */
        }
    }
    catch( problem ) {
        console.log(`Exception thrown: main loop tower logic: ${problem.name}:${problem.message} ${problem.stack}`);
    }
    
    try {
        for(var spawn in Game.spawns) {
            spawner.run(Game.spawns[spawn]);
        }
    }
    catch( problem ) {
        console.log(`Exception thrown main loop spawner runner section: ${problem.name}: ${problem.message} ${problem.stack}  `);
    }
    
    for(var name in Game.creeps) {
        var creep = Game.creeps[name];

        try {
            if(!creep.spawning) {
            
                if(creep.memory.role == 'harvester') {
                    roleHarvester.run(creep);
                }
                if(creep.memory.role == 'upgrader') {
                    roleUpgrader.run(creep);
                }
                if(creep.memory.role == 'builder') {
                    roleBuilder.run(creep);
                }
                if(creep.memory.role == 'transport') {
                    roleTransport.run(creep);
                }
                if(creep.memory.role == 'repairer') {
                    roleRepairer.run(creep);
                }
                if(creep.memory.role == 'attacker') {
                    roleAttacker.run(creep);
                }
                if(creep.memory.role == 'refiller') {
                    roleRefiller.run(creep);
                }
                if(creep.memory.role == 'claimer') {
                    roleClaimer.run(creep);
                }
                if(creep.memory.role == 'breaker') {
                    roleBreaker.run(creep);
                }
            }
        }
        catch( problem ) {
            console.log(`Exception thrown main loop creep process runner section: ${problem.name}: ${problem.message} ${problem.stack}  `);
        }
    }
    
    // if(Game.rooms['W26N57'].controller.level == 5) {
    //     if(Game.flags['Flag1']) {
    //         var result = Game.flags['Flag1'].pos.createConstructionSite(STRUCTURE_TOWER,'Tower2');
    //         if( result == OK )
    //             Game.flags['Flag1'].remove();
    //     }
            
    // }
}

// commands examples
// Memory.rooms[baseCommon.getOwnedRooms()[0]].remoteSources.push({id:'5bbcab769099fc012e6338fb',room:'W27N56',x:'',y:''})
// Memory.rooms[baseCommon.getOwnedRooms()[0]].spawnQueue.push({memory: { role:'harvester',source:'5bbcab769099fc012e6338fb'} })
// Memory.rooms[baseCommon.getOwnedRooms()[0]].spawnQueue.push({memory: { role:'transport',target:'5bbcab769099fc012e6338f6',targetRoom:'W26N58'} })
// Memory.rooms[baseCommon.getOwnedRooms()[0]].spawnQueue.push({memory: { role:'attacker',targetRoom:'W27N56'} })
// Memory.rooms[baseCommon.getOwnedRooms()[0]].spawnQueue.push({memory: { role:'transport'} })
// Memory.rooms[baseCommon.getOwnedRooms()[0]].spawnQueue.push({memory: { role:'claimer',targetRoom:''} })
// Game.spawns['Spawn1'].spawnCreep([WORK,WORK,WORK,WORK,WORK,MOVE],"mc1",{memory:{role:'harvester',source:'5bbcab769099fc012e6338fa'}})
// Game.spawns['Spawn1'].spawnCreep([TOUGH,TOUGH,TOUGH,],"ac1",{memory:{role:'attacker',target:'606893f710cdfaf1e7eae488','targetRoom':'W25N57'}})
// Game.spawns['Spawn1'].spawnCreep([CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,],"refiller1",{memory:{role:'refiller'}})