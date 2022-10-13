var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleTransport = require('role.transport');
var roleRepairer = require('role.repairer');
var roleAttacker = require('role.attacker');
var roleRefiller = require('role.refiller');
var roleClaimer = require('role.claimer');
var roleBreaker = require('role.breaker');
var taskCommon = require('task.common');
var Traveler = require('Traveler');
var spawner = require('spawner');

module.exports.loop = function () {
    
   // try {
        for(var creepName in Memory.creeps) {
            if(!Game.creeps[creepName]) {
                if(!Memory.creeps[creepName].norespawn || Memory.creeps[creepName].role != "breaker" || Memory.creeps[creepName].role != "claimer")
                    spawner.queueSpawn({memory:Memory.creeps[creepName]})
                delete Memory.creeps[creepName];
            }
        }
    //     var e = new Error('Exception caught: Main loop() creep garbage collection and respawn');
    //     throw Error(e);
        
    // }
    // catch( error ) {
    //     console.log(`${e}.stack`);
    // }

    //try {
        /** INITIALIZE STATE */
        if(!Memory.rooms) {
            Memory.rooms = {};
        }
        if(!Memory.homeRoom) {
            for(const i in Game.spawns) {
                Memory.homeRoom = Game.spawns[i].room.name;
                break;
            }
        }
        if( !Memory.rooms[Memory.homeRoom] ) {
            Memory.rooms[Memory.homeRoom] = {};
        }
        if( !Memory.rooms[Memory.homeRoom].spawnQueue ) {
            Memory.rooms[Memory.homeRoom].spawnQueue = []
        }
    
        //in this state it means we have to kickstart/boot the room
        
        //TODO SHOULD BE Memory.rooms and should be sim, but memory is empty of rooms etf
        if( !Game.rooms[Memory.homeRoom].spawnQueue ) {
            Game.rooms[Memory.homeRoom].spawnQueue = []
        }
        
        var creepAmount = 0;
        for(var i in Memory.creeps){creepAmount++};
        
        if( creepAmount < 5 && Memory.rooms[Memory.homeRoom].spawnQueue.length < 1 ) {            
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
            
            // Memory.rooms[Memory.homeRoom].spawnQueue.push({memory: { role:'harvester',source:'5bbcab769099fc012e6338fb'} })
            // Memory.rooms[Memory.homeRoom].spawnQueue.push({memory: { role:'transport',target:'5bbcab769099fc012e6338f6',targetRoom:'W26N58'} })
         }
    // }
    // catch( problem ) {
    //     console.log(`main loop initialization: ${problem}`);
    // }

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
    
        for(var name in Game.creeps) {
            var creep = Game.creeps[name];

            if(!creep.spawning) {
    
                // homeRoom here used to be commented out and can be found on spawner code.
                if(!creep.memory.homeRoom) {
                    creep.memory.homeRoom = Memory.homeRoom;            
                }
        
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
    }
    catch( problem ) {
        console.log(`Exception thrown main loop process runner section: ${problem.name}: ${problem.message} ${problem.stack}  `);
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
// Memory.rooms[Memory.homeRoom].remoteSources.push({id:'5bbcab769099fc012e6338fb',room:'W27N56',x:'',y:''})
// Memory.rooms[Memory.homeRoom].spawnQueue.push({memory: { role:'harvester',source:'5bbcab769099fc012e6338fb'} })
// Memory.rooms[Memory.homeRoom].spawnQueue.push({memory: { role:'harvester',source:'5bbcaf299099fc012e63a417',target:'E38N54'} })
// Memory.rooms[Memory.homeRoom].spawnQueue.push({memory: { role:'transport',target:'5bbcab769099fc012e6338f6',targetRoom:'W26N58'} })
// Memory.rooms[Memory.homeRoom].spawnQueue.push({memory: { role:'attacker',targetRoom:'W27N56'} })
// Memory.rooms[Memory.homeRoom].spawnQueue.push({memory: { role:'claimer',targetRoom:''} })
// Game.spawns['Spawn1'].spawnCreep([WORK,WORK,WORK,WORK,WORK,MOVE],"mc1",{memory:{role:'harvester',source:'5bbcab769099fc012e6338fa'}})
// Game.spawns['Spawn1'].spawnCreep([TOUGH,TOUGH,TOUGH,],"ac1",{memory:{role:'attacker',target:'606893f710cdfaf1e7eae488','targetRoom':'W25N57'}})

// Behaviours i need to understand to make this code work in new games
// homeRoom attribute for refiller and transporter seems to have to be set manually because its commented out in main.js job loop but none in commands? logic depends on it
// How are local source set? with manual command above?
// How are remote source set? I made a command example above to test with, but want to automate this with scouts at some point
// room names are hardcoded right now, need to find an easy way to remember/know this, but initialized state machine might be answer
// Dealing with raiders in remote rooms seem manual with manual attacker creep spawn command, need to automate this but have no intel/alert code
// 

/**
 * Base Development Code Goals
 * 1 - Spawn Container, extension placement, and fast-filler code
 * 2 - S
 */

/**
 * Limitations to deal with asap
 * 
 * 1 - When transports die, the harvesters they serviced still believe with transportCoverage that they have enough
 * 2 - Soon as a storage is built, base died, for same reason it died when i built containers and made things fill it. Have to spawn refiller asap when storage is built.
 * 3 - Fall-back behaviour for roles that are too dependent on developed bases or areas
 * 4 - Basic Defense of main room
 * 5 - Automatic handling of raiders in remote rooms and prioritizing spawning of attacker to deal with it first
 * 6 - Don't call variables in memory directly from roles etc. but rather implement statemachine that can ensure they're initialized and valid before being accessed.
 * 7 - assuming some values e.g. carry capacity for calculations updated already but should use constants not hard values to make code reusable for different worlds
 *  */ 

// IDEAS
// calculator util to optimize planning and decision-making of objects and actions in the game

// warden system - each room has warden object that links like network to base through each other and keeps logic for handling threats and intel
// - remembering hostile position when blinded
// - scout logic to expand warden network
// - reserve logic for remote rooms
// - preserve logic for creep flight and renewal
// - maintenance logic for roads etc
// - base defense logic for owned rooms eg rampart and wall maintenance, towers logic